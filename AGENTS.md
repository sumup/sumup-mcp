# AGENTS.md

Repository guide for coding agents working in `@sumup/mcp`.

## Purpose

- This repository implements a SumUp MCP server as a Cloudflare Worker.
- It uses Hono for routing, a Durable Object-backed `McpAgent` for session handling, and OAuth bearer JWT validation against SumUp auth JWKS.
- Key files: `src/worker.ts`, `src/app.ts`, `src/auth.ts`, `src/protocol.ts`, `src/sumup-agent.ts`.

## Environment and Runtime

- Package manager: `npm`.
- Required runtime: Node.js `>=22`.
- Module system: ESM (`"type": "module"`).
- TypeScript is configured with `strict: true` and `moduleResolution: "bundler"`.
- Local dev and deployment use Cloudflare Wrangler.
- Worker configuration is in `wrangler.jsonc`.
- Durable Object binding name: `SUMUP_MCP_AGENT`.

## Install and Setup

- Install dependencies: `npm install`
- Start local worker dev server: `npm run dev`
- Generate Cloudflare worker types if needed: `npm run generate-types`

## Build, Lint, Typecheck, and Test

- Build/typecheck: `npm run build`
- Explicit typecheck: `npm run typecheck`
- Lint and format check: `npm run lint`
- Auto-fix lint/format issues: `npm run lint:fix`
- Run tests: `npm run test`

## Change Management Guidance for Agents

- Prefer minimal targeted edits; this is a small, focused codebase.
- Do not introduce new dependencies without a clear reason.
- Keep OAuth, MCP, and protocol terminology accurate.
- If changing public behavior, update or add tests in the same change.
- If a change affects contributor workflow, update `CONTRIBUTING.md` or this file as needed.

## PR and Commit Guidance

- Follow Conventional Commits for PR titles and keep PR summaries explicit about behavior changes.

## References

- See Model Context Protocol (MCP) specification at https://modelcontextprotocol.io/specification/latest
- Strictly follow the MCP Authorization guidelines at https://modelcontextprotocol.io/specification/latest/basic/authorization
- Refer to OAuth 2.0 RFCs and standards for further information
