import cheerio from "cheerio";
import got from "got";
import { giganttiURL } from "./config.mjs";
import { parsePriceNumber } from "./utils.mjs";

const parseProduct = ($, e) => {
  const priceText = $(".product-price", e).contents().get(0)?.nodeValue;
  return {
    name: $(".product-name", e).text().trim(),
    sku: `gigantti:${$(".product-number.sku", e).text().trim()}`,
    url: $("a.product-name", e).attr("href"),
    price: priceText ? parsePriceNumber(priceText) : "-",
    canPurchase: $(".add-to-basket-ajax", e).length != 0,
  };
};

export const scrapeProducts = async () => {
  const htmlText = await got.get(giganttiURL).text();
  const $ = cheerio.load(htmlText);
  const $products = $(".mini-product-list .col-mini-product");
  const products = $products.get().map((e) => parseProduct($, e));

  if (products.length === 0) throw new Error("Found no products!");
  return products.filter((p) => p.name.includes("3080") && /ti/i.test(p.name));
};
