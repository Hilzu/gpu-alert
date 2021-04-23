#!/usr/bin/env node

import cheerio from "cheerio";
import got from "got";
import isMain from "es-main";

const giganttiUrl = new URL(process.env.GIGANTTI_URL);
const slackWebhookUrl = new URL(process.env.SLACK_WEBHOOK_URL);
const ignoredSKUs = process.env.IGNORED_SKUS.split(",");

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

const postToSlack = async (payload) => {
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

const postError = async (err) => {
  await postToSlack({ text: err.stack });
};

export const main = async () => {
  const htmlText = await got.get(giganttiUrl).text();
  const products = scrapeProducts(htmlText);
  console.log("Found products:", { products });

  const newProducts = products.filter((p) => !ignoredSKUs.includes(p.sku));
  console.log("Found new products:", { newProducts });
  if (newProducts.length > 0) await postNewProducts(newProducts);
};

if (isMain(import.meta)) {
  main()
    .then(() => {
      console.log("Done");
    })
    .catch((err) => {
      console.error("Unexpected error!", err);
      postError(err).then(() => {
        process.exit(1);
      });
    });
}
