import got from "got";
import { verkkokauppaURL } from "./config.mjs";

const parseProduct = (p) => {
  return {
    name: p.name,
    sku: `vk:${p.productId}`,
    url: new URL(p.href, "https://www.verkkokauppa.com").toString(),
    price: p.price.current,
    canPurchase: p.availability.isPurchasable,
  };
};

export const scrapeProducts = async () => {
  const searchData = await got.get(verkkokauppaURL).json();
  const products = searchData.products.map((p) => parseProduct(p));

  if (products.length === 0) throw new Error("Found no products!");
  return products.filter((p) => /ti/i.test(p.name));
};
