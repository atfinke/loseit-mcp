# Lose It MCP

Unofficial MCP server for Lose It, reverse-engineered from observed web app traffic and validated against live API behavior.

Built entirely by Claude Opus 4.6 via Claude Code.

## Overview

This project exposes Lose It calorie tracking and nutrition data through MCP using the web app's GWT-RPC API.

Supported capabilities include:

- reading daily calorie summary with budget, eaten, and remaining calories
- reading weekly calorie history with per-day breakdowns
- reading food log entries with food names and brands

## API Coverage

The current implementation uses the Lose It web app GWT-RPC endpoint (`www.loseit.com/web/service`) with session cookies obtained from `api.loseit.com/account/login`. The iOS app's protobuf API is not used.

The GWT-RPC policy hash and permutation header are tied to the current Lose It web app build. If Lose It deploys a new version, these values may need updating via environment variables.

## Setup

```bash
npm install
cp .env.example .env
npm test
npm run build
```

Configuration requires:

- `LOSEIT_EMAIL`
- `LOSEIT_PASSWORD`

Optional values:

- `LOSEIT_TIMEZONE` (IANA zone, default `America/Chicago`)
- `LOSEIT_SESSION_PATH` (default `~/.loseit-mcp/session.json`)
- `LOSEIT_REQUEST_TIMEOUT_MS` (default `15000`)
- `LOSEIT_GWT_POLICY_HASH` (override if Lose It deploys a new web build)
- `LOSEIT_GWT_PERMUTATION` (override if Lose It deploys a new web build)

## MCP Setup

The server runs over stdio.

Example client configuration for the built server:

```json
{
  "mcpServers": {
    "loseit": {
      "command": "node",
      "args": ["/absolute/path/to/loseit-mcp/dist/index.js"],
      "cwd": "/absolute/path/to/loseit-mcp"
    }
  }
}
```

For local development without building first:

```json
{
  "mcpServers": {
    "loseit": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/absolute/path/to/loseit-mcp"
    }
  }
}
```

If a client does not support `cwd`, pass the Lose It environment variables directly in the client configuration instead of relying on `.env`.

## Notes

- Session cookies are cached to `~/.loseit-mcp/session.json` to avoid re-authenticating on every server start. The cache is created with restricted file permissions.
- The food log returns food names and brands but does not include per-item calorie or macro breakdowns. Daily totals are available from the daily summary tool.
- The GWT-RPC response parser uses targeted pattern extraction rather than a full generic deserializer.
