<div align="center">

# SumUp MCP Server

[![Documentation][docs-badge]](https://developer.sumup.com)
[![License](https://img.shields.io/github/license/sumup/sumup-ts)](./LICENSE)

</div>

SumUp's [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server for interactions between large language models (LLMs) and SumUp APIs. The MCP server allows you to connect to SumUp's services from an MCP client (e.g. Cursor, Claude) and use natural language to work with your SumUp account.

This package runs as a Cloudflare Worker and serves the MCP transport for SumUp.

Authentication follows the MCP OAuth resource-server flow:

- The worker publishes OAuth metadata and protected resource metadata via `@hono/mcp`.
- Clients send `Authorization: Bearer <access-token>` to `/mcp`.
- Bearer tokens must be JWT access tokens issued by `SUMUP_AUTH_HOST` and valid for the worker resource URL.

The worker exposes `/mcp` for Streamable HTTP and `/sse` for the legacy SSE transport. Both routes are pinned to a Durable Object so MCP session state survives across requests within the same Worker deployment.

## Using from an MCP client

Any client that speaks the Streamable HTTP transport can connect to this server. For example, using [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "sumup": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.sumup.com/mcp",
        "--headers",
        "Authorization: Bearer <your-access-token>"
      ]
    }
  }
}
```

## Development

Development setup, local testing, and contributor workflow live in [CONTRIBUTING.md](./CONTRIBUTING.md).

[docs-badge]: https://img.shields.io/badge/SumUp-documentation-white.svg?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgY29sb3I9IndoaXRlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogICAgPHBhdGggZD0iTTIyLjI5IDBIMS43Qy43NyAwIDAgLjc3IDAgMS43MVYyMi4zYzAgLjkzLjc3IDEuNyAxLjcxIDEuN0gyMi4zYy45NCAwIDEuNzEtLjc3IDEuNzEtMS43MVYxLjdDMjQgLjc3IDIzLjIzIDAgMjIuMjkgMFptLTcuMjIgMTguMDdhNS42MiA1LjYyIDAgMCAxLTcuNjguMjQuMzYuMzYgMCAwIDEtLjAxLS40OWw3LjQ0LTcuNDRhLjM1LjM1IDAgMCAxIC40OSAwIDUuNiA1LjYgMCAwIDEtLjI0IDcuNjlabTEuNTUtMTEuOS03LjQ0IDcuNDVhLjM1LjM1IDAgMCAxLS41IDAgNS42MSA1LjYxIDAgMCAxIDcuOS03Ljk2bC4wMy4wM2MuMTMuMTMuMTQuMzUuMDEuNDlaIiBmaWxsPSJjdXJyZW50Q29sb3IiLz4KPC9zdmc+
