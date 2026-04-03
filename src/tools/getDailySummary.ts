import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { LoseItClient } from "../loseit/client.js";
import { dateToDayNumber, GwtParseError } from "../loseit/gwt.js";
import { extractDailySummary } from "../loseit/extractors.js";
import { READ_ONLY_TOOL_ANNOTATIONS } from "./common.js";
import { errorResponse, textResponse } from "./response.js";

export function registerGetDailySummaryTool(
  server: McpServer,
  client: LoseItClient,
): void {
  server.registerTool(
    "loseit_get_daily_summary",
    {
      title: "Get Daily Summary",
      description:
        "Returns today's calorie and macro summary: calories eaten/remaining, budget, and per-day entries for the current week.",
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
        const { raw } = await client.gwtRpc("getGoalsData", []);

        const targetDate = args.date
          ? new Date(args.date)
          : new Date();
        const targetDayNumber = dateToDayNumber(targetDate);

        const result = extractDailySummary(raw, targetDayNumber);

        if (!result) {
          return errorResponse(
            new Error("No daily summary data found for the requested date"),
          );
        }

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
