<div align="center">

# SumUp MCP Servers

[![Documentation][docs-badge]](https://developer.sumup.com)
[![License](https://img.shields.io/github/license/sumup/sumup-ts)](./LICENSE)

</div>

SumUp's [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) servers for interactions between large language models (LLMs) and SumUp APIs/documentation.

## Apps layout

- `apps/sumup-mcp`: MCP server for SumUp API tools (`mcp.sumup.com`).
- `apps/docs-mcp`: MCP server for developer docs search via AutoRAG (`docs.mcp.sumup.com`).
- `server.json` (root): registry descriptor listing all MCP remotes.

## Getting started

From each app folder, install dependencies and run scripts:

```bash
cd apps/sumup-mcp && npm install && npm run dev
cd apps/docs-mcp && npm install && npm run dev
```

`mcp.sumup.com` requires a SumUp API key via `Authorization: Bearer <apiKey>`.
`docs.mcp.sumup.com` exposes `search_developer_docs` backed by Cloudflare AutoRAG.

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
        "Authorization: Bearer <your-sumup-api-key>"
      ]
    }
  }
}
```

[docs-badge]: https://img.shields.io/badge/SumUp-documentation-white.svg?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgY29sb3I9IndoaXRlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogICAgPHBhdGggZD0iTTIyLjI5IDBIMS43Qy43NyAwIDAgLjc3IDAgMS43MVYyMi4zYzAgLjkzLjc3IDEuNyAxLjcxIDEuN0gyMi4zYy45NCAwIDEuNzEtLjc3IDEuNzEtMS43MVYxLjdDMjQgLjc3IDIzLjIzIDAgMjIuMjkgMFptLTcuMjIgMTguMDdhNS42MiA1LjYyIDAgMCAxLTcuNjguMjQuMzYuMzYgMCAwIDEtLjAxLS40OWw3LjQ0LTcuNDRhLjM1LjM1IDAgMCAxIC40OSAwIDUuNiA1LjYgMCAwIDEtLjI0IDcuNjlabTEuNTUtMTEuOS03LjQ0IDcuNDVhLjM1LjM1IDAgMCAxLS41IDAgNS42MSA1LjYxIDAgMCAxIDcuOS03Ljk2bC4wMy4wM2MuMTMuMTMuMTQuMzUuMDEuNDlaIiBmaWxsPSJjdXJyZW50Q29sb3IiLz4KPC9zdmc+
