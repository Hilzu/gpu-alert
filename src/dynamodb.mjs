import DynamoDB from "aws-sdk/clients/dynamodb.js";
import { dynamoDBTableId as TableName } from "./config.mjs";

const docClient = new DynamoDB.DocumentClient();

export const getSKUs = async (skus) => {
  const params = {
    RequestItems: { [TableName]: { Keys: skus.map((sku) => ({ sku })) } },
  };
  console.log("params:", params);
  const res = await docClient.batchGet(params).promise();
  return res.Responses[TableName];
};

const dayInSeconds = 60 * 60 * 24;

export const createSKU = async (product) => {
  const Item = {
    sku: product.sku,
    ts: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000 + dayInSeconds),
    name: product.name,
  };
  console.log("Put item:", Item);
  await docClient.put({ TableName, Item }).promise();
};
