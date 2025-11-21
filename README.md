# SumUp MCP Server

SumUp's [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server for interactions between large language models (LLMs) and external systems. The server MCP allows you to connect to SumUp's services from an MCP client (e.g. Cursor, Claude) and use natural language to work with your SumUp account.

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

Because the SumUp toolkit already bundles the tools, resources, and metadata we need, this repository simply wires them into a hosted transport without duplicating the multi-app structure from the Cloudflare example.
