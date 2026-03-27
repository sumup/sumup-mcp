import { httpServerHandler } from "cloudflare:node";
import { env } from "cloudflare:workers";
import { createApp } from "./app";

export { SumUpMcpAgent } from "./sumup-agent";

const PORT = 3000;

createApp(env as Env).listen(PORT);

export default httpServerHandler({ port: PORT });
