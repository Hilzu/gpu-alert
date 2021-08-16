import cheerio from "cheerio";
import got from "got";
import { proshopURL } from "./config.mjs";
import { parsePriceNumber } from "./utils.mjs";

const parseProduct = ($, e) => {
  const priceText = $(".site-currency-lg", e).text();
  const $link = $(".site-product-link", e);
  return {
    name: $link.text().trim(),
    sku: `proshop:${$("div:first-of-type small", e).text().trim()}`,
    url: new URL($link.attr("href"), "https://www.proshop.fi").toString(),
    price: priceText ? parsePriceNumber(priceText) : "-",
    canPurchase: $(".site-icon-stock-in", e).length != 0,
  };
};

export const scrapeProducts = async () => {
  const htmlText = await got
    .get(proshopURL, {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "fi-FI",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
      },
    })
    .text();
  const $ = cheerio.load(htmlText);
  const $products = $("#products .row");
  const products = $products.get().map((e) => parseProduct($, e));

  if (products.length === 0) throw new Error("Found no products!");
  return products.filter((p) => p.name.includes("3080") && /ti/i.test(p.name));
};
