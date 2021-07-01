export const parsePriceNumber = (str) =>
  Number.parseFloat(str.replace(/[^0-9,.]/gu, "").replace(",", "."));
