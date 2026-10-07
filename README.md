<div align="center">

# SumUp MCP Server

[![Documentation][docs-badge]](https://developer.sumup.com)
[![License](https://img.shields.io/github/license/sumup/sumup-ts)](./LICENSE)

</div>

SumUp's [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server for interactions between large language models (LLMs) and SumUp APIs. The MCP server allows you to connect to SumUp's services from an MCP client (e.g. Cursor, Claude) and use natural language to work with your SumUp account.

This package runs as a Cloudflare Worker and serves the MCP transport for SumUp.

Authentication follows the MCP OAuth resource-server flow:

- The worker publishes protected resource metadata that points clients to the SumUp authorization server.
- Clients send `Authorization: Bearer <access-token>` to `/mcp`.
- Bearer tokens must be JWT access tokens issued by `SUMUP_AUTH_HOST` and valid for the worker resource URL.

SumUp API keys such as `sup_sk_...` are not valid Bearer tokens for the hosted server.

The worker exposes `/mcp` for Streamable HTTP and `/sse` for the legacy SSE transport. Both routes are pinned to a Durable Object so MCP session state survives across requests within the same Worker deployment.

## Using from an MCP client

Connect an OAuth-capable Streamable HTTP client to `https://mcp.sumup.com/mcp` and sign in with SumUp in your browser. The client discovers the authorization server from the protected resource metadata.

### Install skills and MCP together

The [SumUp plugin](https://github.com/sumup/sumup-skills) includes integration skills and hosted MCP configuration. For Codex:

```sh
codex plugin marketplace add sumup/sumup-skills
codex plugin add sumup@sumup
codex plugin list
```

Start a new session and complete authorization when prompted. For other assistants, see the [plugin setup guide](https://developer.sumup.com/tools/llms/plugins/).

### Connect directly

If you only need MCP tools, configure the hosted server directly. For Codex:

```sh
codex mcp add sumup --url https://mcp.sumup.com/mcp
codex mcp login sumup
codex mcp list
```

For Claude Code:

```sh
claude mcp add --transport http --scope user sumup https://mcp.sumup.com/mcp
claude mcp list
```

Open `/mcp` in Claude Code to authenticate. For Cursor, merge this entry into `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "sumup": {
      "url": "https://mcp.sumup.com/mcp"
    }
  }
}
```

Complete authorization in Cursor's MCP settings. If you installed the SumUp plugin, use its bundled connection instead of adding a duplicate manual entry.

After connecting, try a read-only prompt: "Use the SumUp MCP tools to show my merchant profile."

See the [MCP setup guide](https://developer.sumup.com/tools/llms/mcp-server/) for Gemini CLI, VS Code, Claude Desktop, and troubleshooting. For stdio clients and API-key workflows, use the [local MCP CLI](https://github.com/sumup/sumup-ai/tree/main/mcp), which requires Node.js 22 or later.

## Development

Development setup, local testing, and contributor workflow live in [CONTRIBUTING.md](./CONTRIBUTING.md).

[docs-badge]: https://img.shields.io/badge/SumUp-documentation-white.svg?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgY29sb3I9IndoaXRlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogICAgPHBhdGggZD0iTTIyLjI5IDBIMS43Qy43NyAwIDAgLjc3IDAgMS43MVYyMi4zYzAgLjkzLjc3IDEuNyAxLjcxIDEuN0gyMi4zYy45NCAwIDEuNzEtLjc3IDEuNzEtMS43MVYxLjdDMjQgLjc3IDIzLjIzIDAgMjIuMjkgMFptLTcuMjIgMTguMDdhNS42MiA1LjYyIDAgMCAxLTcuNjguMjQuMzYuMzYgMCAwIDEtLjAxLS40OWw3LjQ0LTcuNDRhLjM1LjM1IDAgMCAxIC40OSAwIDUuNiA1LjYgMCAwIDEtLjI0IDcuNjlabTEuNTUtMTEuOS03LjQ0IDcuNDVhLjM1LjM1IDAgMCAxLS41IDAgNS42MSA1LjYxIDAgMCAxIDcuOS03Ljk2bC4wMy4wM2MuMTMuMTMuMTQuMzUuMDEuNDlaIiBmaWxsPSJjdXJyZW50Q29sb3IiLz4KPC9zdmc+
