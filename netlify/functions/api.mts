import type { Config } from "@netlify/functions";
import { handleApi } from "../../server/handler";
export default (request: Request) => handleApi(request);
export const config: Config = { path: "/api/*" };
