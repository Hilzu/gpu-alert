import cheerio from "cheerio";
import DynamoDB from "aws-sdk/clients/dynamodb.js";
import got from "got";

const giganttiUrl = new URL(process.env.GIGANTTI_URL);
const slackWebhookUrl = new URL(process.env.SLACK_WEBHOOK_URL);
const ignoredSKUs = new Set(process.env.IGNORED_SKUS.split(","));
const TableName = process.env.DYNAMODB_TABLE_ID;
const docClient = new DynamoDB.DocumentClient();

const scrapeProducts = (htmlText) => {
  const $ = cheerio.load(htmlText);
  const $products = $(".mini-product-list .col-mini-product");
  const products = $products.get().map((e) => {
    return {
      name: $(".product-name", e).text().trim(),
      sku: $(".product-number.sku", e).text().trim(),
      url: $("a.product-name", e).attr("href"),
      price: (
        $(".product-price", e).contents().get(0)?.nodeValue || "-"
      ).trim(),
      canPurchase: $(".add-to-basket-ajax", e).length != 0,
    };
  });

  if (products.length === 0) throw new Error("Found no products!");
  return products;
};

const postToSlack = async (payload) => {
  await got.post(slackWebhookUrl, {
    json: { username: "gigantti-gpu-alert", ...payload },
    retry: { methods: ["POST"] },
  });
};

const postNewProducts = async (products) => {
  const formattedProducts = products
    .map((p) => `<${p.url}|${p.name}>  ${p.price} € (sku: ${p.sku})`)
    .join("\n");
  await postToSlack({ text: `Found new GPUs!\n${formattedProducts}` });
};

const getSKU = async (sku) => {
  const query = {
    TableName,
    KeyConditionExpression: "sku = :sku",
    ExpressionAttributeValues: { ":sku": sku },
  };
  console.log("Query:", query);
  const res = await docClient.query(query).promise();
  if (res.Count > 1) throw new Error(`Got multiple items for SKU: ${sku}`);
  return res.Items?.[0];
};

const dayInSeconds = 60 * 60 * 24;

const createSKU = async (product) => {
  const Item = {
    sku: product.sku,
    ts: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000 + dayInSeconds),
    name: product.name,
  };
  console.log("Put item:", Item);
  await docClient.put({ TableName, Item }).promise();
};

export const main = async () => {
  const htmlText = await got.get(giganttiUrl).text();
  const products = scrapeProducts(htmlText);
  console.log("Found products:", products);

  const newProducts = products.filter((p) => !ignoredSKUs.has(p.sku));
  console.log("Found new products:", newProducts);
  if (newProducts.length === 0) {
    console.log("No new products");
    return;
  }

  let unseenNewProducts = [];
  for (const product of newProducts) {
    const sku = await getSKU(product.sku);
    if (sku) console.log("Product seen previously:", sku);
    else if (product.canPurchase) unseenNewProducts.push(product);
  }
  if (unseenNewProducts.length === 0) {
    console.log("No new unseen products");
    return;
  }

  console.log("Posting and marking items as seen", unseenNewProducts);
  await postNewProducts(unseenNewProducts);
  for (const unseenNewProduct of unseenNewProducts) {
    await createSKU(unseenNewProduct);
  }
};

export const handler = async (event) => {
  console.log("Received event", event);
  await main();
};
