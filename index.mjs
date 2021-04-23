import cheerio from "cheerio";
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import got from "got";

const giganttiUrl = new URL(process.env.GIGANTTI_URL);
const slackWebhookUrl = new URL(process.env.SLACK_WEBHOOK_URL);
const ignoredSKUs = process.env.IGNORED_SKUS.split(",");
const TableName = process.env.DYNAMODB_TABLE_ID;
const ddbClient = new DynamoDBClient({});

const scrapeProducts = (htmlText) => {
  const $ = cheerio.load(htmlText);
  const $products = $(".mini-product-list .col-mini-product");
  const products = $products.get().map((e) => {
    return {
      name: $(".product-name", e).text().trim(),
      sku: $(".product-number.sku", e).text().trim(),
      url: $("a.product-name", e).attr("href"),
    };
  });

  if (products.length === 0) throw new Error("Found no products!");
  return products;
};

export const postToSlack = async (payload) => {
  await got.post(slackWebhookUrl, {
    json: { username: "gigantti-gpu-alert", ...payload },
    retry: { methods: ["POST"] },
  });
};

const postNewProducts = async (products) => {
  const formattedProducts = products
    .map((p) => `<${p.url}|${p.name}>`)
    .join("\n");
  await postToSlack({ text: `Found new GPUs!\n${formattedProducts}` });
};

const getSKU = async (sku) => {
  const command = new QueryCommand({
    TableName,
    KeyConditionExpression: "sku = :sku",
    ExpressionAttributeValues: { ":sku": { S: sku } },
  });
  const res = await ddbClient.send(command);
  if (res.Count > 1) throw new Error(`Got multiple items for SKU: ${sku}`);
  return res.Items?.[0];
};

const dayInSeconds = 60 * 60 * 24;

const createSKU = async (sku) => {
  const Item = {
    sku: { S: sku },
    ts: { S: new Date().toISOString() },
    ttl: { N: `${Math.floor(Date.now() / 1000 + dayInSeconds)}` },
  };
  console.log("Writing SKU item", Item);
  const command = new PutItemCommand({ TableName, Item });
  await ddbClient.send(command);
};

export const main = async () => {
  const htmlText = await got.get(giganttiUrl).text();
  const products = scrapeProducts(htmlText);
  console.log("Found products:", products);

  const newProducts = products.filter((p) => !ignoredSKUs.includes(p.sku));
  console.log("Found new products:", newProducts);
  if (newProducts.length === 0) {
    console.log("No new products");
    return;
  }

  let unseenNewProducts = [];
  for (const product of newProducts) {
    const sku = await getSKU(product.sku);
    if (sku) console.log("Product seen previously", sku);
    else unseenNewProducts.push(product);
  }
  if (unseenNewProducts.length === 0) {
    console.log("No new unseen products");
    return;
  }

  postNewProducts(unseenNewProducts);
  for (const unseenNewProduct of unseenNewProducts) {
    await createSKU(unseenNewProduct.sku);
  }
};

export const handler = async (event) => {
  console.log("Received event", event);
  await main();
};
