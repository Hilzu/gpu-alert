#!/usr/bin/env node

import { main } from "./main.mjs";

main()
  .then(() => {
    console.log("Done");
  })
  .catch((err) => {
    console.error("Unexpected error!", err);
    process.exitCode = 1;
  });
