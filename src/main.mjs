import { scrapeProducts as scrapeGiganttiProducts } from "./gigantti.mjs";
import { scrapeProducts as scrapeJimmsProducts } from "./jimms.mjs";
import { scrapeProducts as scrapeVKProducts } from "./verkkokauppa.mjs";
import { postToSlack } from "./slack.mjs";
import { getSKUs, createSKU } from "./dynamodb.mjs";

const postNewProducts = async (products) => {
  const formattedProducts = products
    .map((p) => `<${p.url}|${p.name}>  ${p.price} € (sku: ${p.sku})`)
    .join("\n");
  await postToSlack({ text: `Found new GPUs!\n${formattedProducts}` });
};

export const main = async () => {
  const products = (
    await Promise.all([
      scrapeGiganttiProducts(),
      scrapeJimmsProducts(),
      scrapeVKProducts(),
    ])
  ).flat();
  console.log("Found products:", products);

  const filteredProducts = products.filter(
    (p) => p.price < 1800 && p.canPurchase,
  );
  console.log("Filtered products:", filteredProducts);
  if (filteredProducts.length === 0) {
    console.log("No new products");
    return;
  }

  const seenProducts = await getSKUs(filteredProducts.map((p) => p.sku));
  const seenSKUs = new Set(seenProducts.map((p) => p.sku));
  const unseenNewProducts = filteredProducts.filter(
    (p) => !seenSKUs.includes(p.sku),
  );
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
