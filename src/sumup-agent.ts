import { SumUpAgentToolkit } from "@sumup/agent-toolkit/mcp";
import { McpAgent } from "agents/mcp";

export interface SumUpAgentProps extends Record<string, unknown> {
	apiKey?: string;
}

type AgentServer = McpAgent<Env, never, SumUpAgentProps>["server"];

export function createSumUpServer({ apiKey }: { apiKey: string }): AgentServer {
	return new SumUpAgentToolkit({
		apiKey,
		configuration: {
			capabilities: {
				resources: {},
				tools: {},
			},
		},
	}) as unknown as AgentServer;
}

export class SumUpMcpAgent extends McpAgent<Env, never, SumUpAgentProps> {
	server!: AgentServer;

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
		}) as unknown as AgentServer;
	}
}
