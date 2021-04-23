#!/usr/bin/env node

import { postToSlack, main } from "./index.mjs";

const postError = async (err) => {
  await postToSlack({ text: err.stack });
};

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
