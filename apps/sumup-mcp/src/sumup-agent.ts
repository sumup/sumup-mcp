import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SumUpAgentToolkit } from "@sumup/agent-toolkit/mcp";
import { McpAgent } from "agents/mcp";

export interface SumUpEnv {
	HOST: string;
	SUMUP_API_HOST: string;
	SUMUP_AUTH_HOST: string;
	OPENAI_APPS_CHALLENGE?: string;
	SUMUP_MCP_AGENT: DurableObjectNamespace;
}

export function createSumUpServer({ apiKey }: { apiKey: string }): McpServer {
	return new SumUpAgentToolkit({
		apiKey,
		configuration: {
			capabilities: {
				resources: {},
				tools: {},
			},
		},
	}) as unknown as McpServer;
}

export interface SumUpAgentProps extends Record<string, unknown> {
	apiKey?: string;
}

export class SumUpMcpAgent extends McpAgent<SumUpEnv, never, SumUpAgentProps> {
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
		const props = this.props;
		if (!props?.apiKey) {
			throw new Error("Missing SumUp API key");
		}

		this.server = new SumUpAgentToolkit({
			apiKey: props.apiKey,
			host: this.env.SUMUP_API_HOST,
			resource: this.env.HOST,
			configuration: {
				capabilities: {
					resources: {},
					tools: {},
				},
			},
		}) as unknown as McpServer;
	}
}
