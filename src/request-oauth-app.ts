import { endpoints } from "./endpoints";
import type { ClientTypes, Options, Auth } from "./types";

// request `@octokit/oauth-app` endpoint for `command` with `payload`
export async function requestOAuthApp<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean
>(
  options: Options<ClientType, ExpirationEnabled>,
  command: keyof typeof endpoints,
  auth: Auth<ClientType, ExpirationEnabled> | null,
  payload: Record<string, unknown>
) {
  const [method, path] = endpoints[command];
  const headers: Record<string, string> = {};
  const token = auth?.token;
  if (token) headers.authorization = "token " + token;
  const route = options.serviceOrigin + options.servicePathPrefix + path;
  return await options.request(route, { method, headers, ...payload });
}
