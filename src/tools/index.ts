import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { LoseItClient } from "../loseit/client.js";
import { registerGetDailySummaryTool } from "./getDailySummary.js";
import { registerGetFoodLogTool } from "./getFoodLog.js";

export function registerTools(
  server: McpServer,
  client: LoseItClient,
): void {
  registerGetDailySummaryTool(server, client);
  registerGetFoodLogTool(server, client);
}
