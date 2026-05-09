import { handleVercelApiRequest } from "../vercel-api-handler.mjs";

export default async function handler(request, response) {
  await handleVercelApiRequest(request, response);
}
