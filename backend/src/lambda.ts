import { configure } from "@codegenie/serverless-express";
import { app } from "./app.js";
// No listener, timer, background worker or local storage in the Lambda entry.
export const handler = configure({
  app,
  binarySettings: {
    isBinary: ({ headers }: { headers: Record<string, unknown> }) =>
      /pdf|image|octet-stream/.test(String(headers["content-type"] || "")),
  },
});
