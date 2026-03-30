import { httpServerHandler } from "cloudflare:node";
import { env } from "cloudflare:workers";
import { createApp } from "./app";

export { SumUpMcpAgent } from "./sumup-agent";

const PORT = 3000;
const server = createApp(env as Env).listen(PORT);
const nodeStyleServer = {
	listen() {
		return this;
	},
	address() {
		const address = server.address();
		if (typeof address === "object" && address) {
			return { port: address.port };
		}

		return { port: PORT };
	},
};

export default httpServerHandler(nodeStyleServer);
