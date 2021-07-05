import cheerio from "cheerio";
import got from "got";
import { jimmsURL } from "./config.mjs";
import { parsePriceNumber } from "./utils.mjs";

const parseProduct = ($, e) => {
  const href = $(".p_name a", e).attr("href").trim();
  const priceText = $(".p_price", e).text().trim();
  return {
    name: $(".p_name", e).text().trim(),
    sku: `jimms:${$(".codetext", e).text().trim()}`,
    url: new URL(href, "https://www.jimms.fi").toString(),
    price: priceText ? parsePriceNumber(priceText) : "-",
    canPurchase: $(".dtext", e).text().includes("työpäivä"),
  };
};

export const scrapeProducts = async () => {
  const htmlText = await got.get(jimmsURL).text();
  const $ = cheerio.load(htmlText, { scriptingEnabled: false });
  const $products = $(".productlist .p_listTmpl1");
  const products = $products.get().map((e) => parseProduct($, e));
  if (products.length === 0) throw new Error("Found no products!");
  return products;
};
