<div align="center">

# SumUp MCP Server

[![Documentation][docs-badge]](https://developer.sumup.com)
[![License](https://img.shields.io/github/license/sumup/sumup-ts)](./LICENSE)

</div>

SumUp's [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server for interactions between large language models (LLMs) and SumUp APIs. The MCP server allows you to connect to SumUp's services from an MCP client (e.g. Cursor, Claude) and use natural language to work with your SumUp account.

## Getting started

```bash
npm install
wrangler dev                             # or `npm run dev`
```

Every MCP request must include a SumUp API key through the `Authorization: Bearer <apiKey>` header. We currently don't support other authentication methods. The worker listens on `/mcp` for the Streamable HTTP transport and `/sse` for the legacy SSE transport.

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

Because the SumUp's agent toolkit already bundles the tools, resources, and metadata we need, this repository simply wires them into a hosted transport without duplicating the multi-app structure from the Cloudflare example.

[docs-badge]: https://img.shields.io/badge/SumUp-documentation-white.svg?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgY29sb3I9IndoaXRlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogICAgPHBhdGggZD0iTTIyLjI5IDBIMS43Qy43NyAwIDAgLjc3IDAgMS43MVYyMi4zYzAgLjkzLjc3IDEuNyAxLjcxIDEuN0gyMi4zYy45NCAwIDEuNzEtLjc3IDEuNzEtMS43MVYxLjdDMjQgLjc3IDIzLjIzIDAgMjIuMjkgMFptLTcuMjIgMTguMDdhNS42MiA1LjYyIDAgMCAxLTcuNjguMjQuMzYuMzYgMCAwIDEtLjAxLS40OWw3LjQ0LTcuNDRhLjM1LjM1IDAgMCAxIC40OSAwIDUuNiA1LjYgMCAwIDEtLjI0IDcuNjlabTEuNTUtMTEuOS03LjQ0IDcuNDVhLjM1LjM1IDAgMCAxLS41IDAgNS42MSA1LjYxIDAgMCAxIDcuOS03Ljk2bC4wMy4wM2MuMTMuMTMuMTQuMzUuMDEuNDlaIiBmaWxsPSJjdXJyZW50Q29sb3IiLz4KPC9zdmc+
