import { SumUpAgentToolkit } from "@sumup/agent-toolkit/mcp";
import { McpAgent } from "agents/mcp";

import { protectedResourceMetadataUrl } from "./auth";
import { MCP_ROUTE } from "./config";

export interface SumUpAgentProps extends Record<string, unknown> {
	token?: string;
}

type AgentServer = McpAgent<Env, never, SumUpAgentProps>["server"];

export class SumUpMcpAgent extends McpAgent<Env, never, SumUpAgentProps> {
	server!: AgentServer;

	async init() {
		const props = this.props;
		if (!props?.token) {
			throw new Error("Authentication required");
		}

		this.server = new SumUpAgentToolkit({
			apiKey: props.token,
			host: this.env.SUMUP_API_HOST,
			resource: new URL(MCP_ROUTE, this.env.HOST).toString(),
			resourceMetadata: protectedResourceMetadataUrl(this.env, MCP_ROUTE),
			configuration: {
				capabilities: {
					resources: {},
					tools: {},
				},
			},
		}) as unknown as AgentServer;
	}
}
