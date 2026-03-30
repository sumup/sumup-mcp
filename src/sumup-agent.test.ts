import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { SumUpAgentToolkit } from "@sumup/agent-toolkit/mcp";
import { afterEach, describe, expect, test } from "vitest";

import { MCP_ROUTE, PROTECTED_RESOURCE_WELL_KNOWN } from "./config";

const serverUrl = "https://mcp-theta.sam-app.ro";

const transportsToClose = new Set<{
	client: Client;
	server: SumUpAgentToolkit;
}>();

afterEach(async () => {
	await Promise.all(
		Array.from(transportsToClose, async ({ client, server }) => {
			await client.close();
			await server.close();
		}),
	);
	transportsToClose.clear();
});

describe("SumUpAgentToolkit MCP integration", () => {
	test("lists tools and resources over an SDK client transport", async () => {
		const server = new SumUpAgentToolkit({
			apiKey: "test-token",
			host: "https://api.sumup.com",
			resource: new URL(MCP_ROUTE, serverUrl).toString(),
			resourceMetadata: new URL(
				`${PROTECTED_RESOURCE_WELL_KNOWN}${MCP_ROUTE}`,
				serverUrl,
			).toString(),
			configuration: {
				capabilities: {
					resources: {},
					tools: {},
				},
			},
		});
		const client = new Client({
			name: "sumup-mcp-test-client",
			version: "1.0.0",
		});
		transportsToClose.add({ client, server });

		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();

		await server.connect(serverTransport);
		await client.connect(clientTransport);

		const tools = await client.listTools();
		const resources = await client.listResources();

		expect(tools.tools.length).toBeGreaterThan(0);
		expect(tools.tools.map((tool) => tool.name)).toContain("create_checkout");
		expect(resources.resources.map((resource) => resource.name)).toEqual(
			expect.arrayContaining([
				"SumUp developer documentation",
				"SumUp API OpenAPI specification",
			]),
		);
	});
});
