export function textResponse(value: unknown) {
  return {
    structuredContent: {
      result: value,
    },
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error);
  return {
    isError: true as const,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message }, null, 2),
      },
    ],
  };
}
