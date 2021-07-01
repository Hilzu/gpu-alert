import got from "got";
import { slackWebhookURL } from "./config.mjs";

export const postToSlack = async (payload) => {
  await got.post(slackWebhookURL, {
    json: { username: "gpu-alert", ...payload },
    retry: { methods: ["POST"] },
  });
};
