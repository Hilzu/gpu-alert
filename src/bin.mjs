#!/usr/bin/env node

import { main } from "./main.mjs";

main()
  .then(() => {
    console.log("Done");
  })
  .catch((err) => {
    console.error("Unexpected error!", err);
    if (err.options) console.log(err.options);
    if (err.response?.body) console.log(err.response.body);
    process.exitCode = 1;
  });
