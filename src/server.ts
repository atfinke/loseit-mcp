import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { LoseItClient } from "./loseit/client.js";
import { APP_NAME, APP_VERSION } from "./meta.js";
import { registerTools } from "./tools/index.js";

export function createServer(client: LoseItClient): McpServer {
  const server = new McpServer({
    name: APP_NAME,
    version: APP_VERSION,
  });

  registerTools(server, client);

  return server;
}
