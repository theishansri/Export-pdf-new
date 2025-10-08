import serverless from "serverless-http";

import { createServer } from "../../server";

export const handler = serverless(await createServer());
