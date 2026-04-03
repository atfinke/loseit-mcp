import { z } from "zod";

export function createToolResultSchema<TSchema extends z.ZodTypeAny>(
  resultSchema: TSchema,
) {
  return z.object({
    result: resultSchema,
  });
}

export const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const WRITE_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};
