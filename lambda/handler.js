"use strict";

exports.handler = async function handler(event) {
  console.log("Received event", event);
  const index = await import("../index.mjs");
  await index.main();
};
