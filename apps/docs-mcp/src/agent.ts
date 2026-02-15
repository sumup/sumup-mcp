import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import * as z from "zod/v4";

type AutoRAGSearchResult = {
	content?: string;
	text?: string;
	source?: string;
	url?: string;
	score?: number;
	attributes?: Record<string, unknown>;
};

type AutoRAGSearchResponse = {
	data?: AutoRAGSearchResult[];
};

type AIBinding = {
	autorag: (name: string) => {
		search: (params: {
			query: string;
			max_num_results?: number;
		}) => Promise<AutoRAGSearchResponse>;
	};
};

export interface DocsEnv {
	AI: AIBinding;
	SUMUP_DEVELOPER_DOCS_AUTORAG: string;
	SUMUP_DOCS_MCP_AGENT: DurableObjectNamespace;
}

export class DocsMcpAgent extends McpAgent<
	DocsEnv,
	never,
	Record<string, unknown>
> {
	private _server: McpServer | undefined;

	set server(server: McpServer) {
		this._server = server;
	}

	get server(): McpServer {
		if (!this._server) {
			throw new Error("Tried to access MCP server before it was initialized");
		}
		return this._server;
	}

	async init() {
		const server = new McpServer(
			{
				name: "SumUp Developer Docs",
				version: "1.0.0",
			},
			{
				capabilities: {
					resources: {},
					tools: {},
				},
			},
		);

		server.registerResource(
			"SumUp developer documentation",
			"https://developer.sumup.com/llms.txt",
			{
				mimeType: "text/plain",
			},
			async (uri) => {
				const content = await fetch("https://developer.sumup.com/llms.txt");
				return {
					contents: [
						{
							uri: uri.toString(),
							mimeType: "text/plain",
							text: await content.text(),
						},
					],
				};
			},
		);

		server.registerTool(
			"search_developer_docs",
			{
				title: "Search SumUp developer docs",
				description:
					"Search SumUp developer documentation using Cloudflare AutoRAG.",
				inputSchema: {
					query: z
						.string()
						.min(1)
						.describe(
							"Natural-language query used to search developer documentation.",
						),
					maxNumResults: z
						.number()
						.int()
						.min(1)
						.max(20)
						.optional()
						.describe("Optional limit on the number of returned results."),
				},
				outputSchema: {
					query: z.string(),
					results: z.array(
						z.object({
							content: z.string(),
							source: z.string().optional(),
							sourceUrl: z.string().optional(),
							score: z.number().optional(),
						}),
					),
				},
				annotations: {
					title: "Search SumUp developer docs",
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
				},
			},
			async ({
				query,
				maxNumResults,
			}: {
				query: string;
				maxNumResults?: number;
			}) => {
				const searchResult = await this.env.AI.autorag(
					this.env.SUMUP_DEVELOPER_DOCS_AUTORAG,
				).search({
					query,
					max_num_results: maxNumResults,
				});

				const results = (searchResult.data ?? [])
					.map((entry) => {
						const sourceAttr = entry.attributes?.source;
						const urlAttr = entry.attributes?.url;
						const source =
							typeof sourceAttr === "string" ? sourceAttr : entry.source;
						const sourceUrl = typeof urlAttr === "string" ? urlAttr : entry.url;
						const content = entry.content ?? entry.text ?? "";

						if (!content) {
							return null;
						}

						return {
							content,
							source,
							sourceUrl,
							score: entry.score,
						};
					})
					.filter(
						(entry): entry is NonNullable<typeof entry> => entry !== null,
					);

				const structuredContent = {
					query,
					results,
				};

				return {
					structuredContent,
					content: [{ type: "text", text: JSON.stringify(structuredContent) }],
				};
			},
		);

		this.server = server;
	}
}
