import { z } from "zod";

const envSchema = z.object({
  LOSEIT_EMAIL: z.string().trim().min(1),
  LOSEIT_PASSWORD: z.string().trim().min(1),
  LOSEIT_TIMEZONE: z.string().trim().min(1).default("America/Chicago"),
  LOSEIT_SESSION_PATH: z
    .string()
    .trim()
    .min(1)
    .default("~/.loseit-mcp/session.json"),
  LOSEIT_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(120_000)
    .default(15_000),
  LOSEIT_GWT_POLICY_HASH: z
    .string()
    .trim()
    .min(1)
    .default("2755A092A086CADF822A722370D298F9"),
  LOSEIT_GWT_PERMUTATION: z
    .string()
    .trim()
    .min(1)
    .default("79FCB90B69F5FF2C7877662E5529652C"),
});

export interface LoseItConfig {
  email: string;
  password: string;
  timezone: string;
  sessionPath: string;
  requestTimeoutMs: number;
  gwt: {
    moduleBase: string;
    policyHash: string;
    permutation: string;
    serviceClass: string;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): LoseItConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid Lose It MCP configuration: ${message}`);
  }

  const sessionPath = parsed.data.LOSEIT_SESSION_PATH.replace(
    /^~/,
    process.env["HOME"] ?? "",
  );

  const usingDefaultHash =
    parsed.data.LOSEIT_GWT_POLICY_HASH ===
    "2755A092A086CADF822A722370D298F9";
  const usingDefaultPerm =
    parsed.data.LOSEIT_GWT_PERMUTATION ===
    "79FCB90B69F5FF2C7877662E5529652C";

  if (usingDefaultHash || usingDefaultPerm) {
    console.error(
      "Warning: using hardcoded GWT policy hash/permutation. These may break if Lose It deploys a new web build. Set LOSEIT_GWT_POLICY_HASH and LOSEIT_GWT_PERMUTATION env vars to override.",
    );
  }

  return {
    email: parsed.data.LOSEIT_EMAIL,
    password: parsed.data.LOSEIT_PASSWORD,
    timezone: parsed.data.LOSEIT_TIMEZONE,
    sessionPath,
    requestTimeoutMs: parsed.data.LOSEIT_REQUEST_TIMEOUT_MS,
    gwt: {
      moduleBase: "https://d3hsih69yn4d89.cloudfront.net/web/",
      policyHash: parsed.data.LOSEIT_GWT_POLICY_HASH,
      permutation: parsed.data.LOSEIT_GWT_PERMUTATION,
      serviceClass:
        "com.loseit.core.client.service.LoseItRemoteService",
    },
  };
}
