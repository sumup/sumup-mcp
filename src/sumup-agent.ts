import { SumUpAgentToolkit } from "@sumup/agent-toolkit/mcp";
import { McpAgent } from "agents/mcp";

import { MCP_ROUTE, PROTECTED_RESOURCE_WELL_KNOWN } from "./config";

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
			resourceMetadata: new URL(
				PROTECTED_RESOURCE_WELL_KNOWN,
				this.env.HOST,
			).toString(),
			configuration: {
				capabilities: {
					resources: {},
					tools: {},
				},
			},
		}) as unknown as AgentServer;
	}
}
