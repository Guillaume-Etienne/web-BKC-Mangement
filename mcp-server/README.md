# bkc-mcp-server

Local MCP server for BKC. Runs on gui's own machine only, never deployed. Talks to Supabase
with a `service_role` key (bypasses RLS), so it can read and write directly — no anon key, no
`x-share-token` needed.

Scope (agreed 2026-08-16, see `.claude/docs/BACKLOG.md` and project memory): enquiries,
bookings, pending actions, accounting summary. **Never touches planning (dates/rooms/lessons),
payments, or deletions.**

## Setup

```
cd mcp-server
npm install
cp .env.example .env
```

Fill in `.env` with the `service_role` key from Supabase → Project Settings → API, for TEST
and/or PROD. **Leave `SUPABASE_TARGET=test` until every tool has been exercised against TEST.**

## Running

Not a daemon — the MCP client (Claude Desktop/Code) starts and stops the process per session.
Add to your MCP client config:

```json
{
  "mcpServers": {
    "bkc": {
      "command": "npx",
      "args": ["tsx", "C:/gui/web/2026/Claude-Code-Projet/mcp-server/src/index.ts"],
      "cwd": "C:/gui/web/2026/Claude-Code-Projet/mcp-server"
    }
  }
}
```

(`cwd` matters — that's where `dotenv` looks for `.env`.)

To run it standalone for a smoke test: `npm start` (needs a stdio MCP client attached, e.g.
`npx @modelcontextprotocol/inspector npx tsx src/index.ts`).

## Design note

This server does not reimplement any pricing or business-rule logic — it imports the real
functions straight from `client/src/...` (season totals, pending actions, enquiry silence
rules, booking creation shape). See the file-by-file mapping in the implementation plan. If
`client/src` moves or renames one of these, `npm run typecheck` here will fail loudly rather
than silently drifting.
