import "dotenv/config";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { LoseItClient } from "./loseit/client.js";
import { registerLoseItTypes } from "./loseit/types.js";
import { APP_NAME } from "./meta.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();

  registerLoseItTypes();

  const client = new LoseItClient(config);
  await client.initialize();

  const server = createServer(client);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error(`${APP_NAME} is running on stdio`);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exit(1);
});
