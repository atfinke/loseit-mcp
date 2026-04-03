import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { LoseItClient } from "../loseit/client.js";
import { dateToDayNumber, GwtParseError } from "../loseit/gwt.js";
import { extractFoodLog } from "../loseit/extractors.js";
import { READ_ONLY_TOOL_ANNOTATIONS } from "./common.js";
import { errorResponse, textResponse } from "./response.js";

export function registerGetFoodLogTool(
  server: McpServer,
  client: LoseItClient,
): void {
  server.registerTool(
    "loseit_get_food_log",
    {
      title: "Get Food Log",
      description:
        "Returns the food log for a given day: each entry with food name and brand. Use get_daily_summary for calorie totals.",
      inputSchema: {
        date: z
          .string()
          .optional()
          .describe(
            "ISO date string (YYYY-MM-DD). Defaults to today.",
          ),
      },
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => {
      try {
        const { raw } = await client.gwtRpc(
          "getInitializationData",
          [],
        );

        const targetDate = args.date
          ? new Date(args.date)
          : new Date();
        const targetDayNumber = dateToDayNumber(targetDate);

        const result = extractFoodLog(raw, targetDayNumber);
        return textResponse(result);
      } catch (error) {
        if (error instanceof GwtParseError) {
          return errorResponse(error);
        }
        throw error;
      }
    },
  );
}
