# Contributing

## Development

```sh
npm install
npm run dev
```

The worker is implemented with Hono and serves MCP routes through a Durable Object-backed `McpAgent`.

## Testing

To test the server, you can use for example [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```sh
npx @modelcontextprotocol/inspector
```

Run the local checks before opening a PR:

```sh
npm run build
npm run test
npm run lint
```

## Local package development

When testing locally against changes in `@sumup/agent-toolkit` install it using `npm i ../path/to/agent-toolkit`.

## Conventional Commits

We rely on [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) which are used to generate changelog. All PR titles must follow the conventional commits standard.
