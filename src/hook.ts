import type {
  EndpointDefaults,
  EndpointOptions,
  OctokitResponse,
  RequestInterface,
  RequestParameters,
  Route,
} from "@octokit/types";
import { requiresBasicAuth } from "@octokit/auth-oauth-user";
import type { ClientTypes, Options } from "./types";
import { auth } from "./auth";
import { errors } from "./errors";

type AnyResponse = OctokitResponse<any>;

export function hook<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean
>(
  options: Options<ClientType, ExpirationEnabled>
): (
  request: RequestInterface,
  route: Route | EndpointOptions,
  parameters: RequestParameters
) => Promise<AnyResponse> {
  return async function _hook(
    request: RequestInterface,
    route: Route | EndpointOptions,
    parameters: RequestParameters = {}
  ): Promise<AnyResponse> {
    const endpoint = request.endpoint.merge(
      route as string,
      parameters
    ) as EndpointDefaults & { url: string };

    // Do not intercept OAuth Web flow requests.
    const oauthWebFlowUrls = /\/login\/(oauth\/access_token|device\/code)$/;
    if (oauthWebFlowUrls.test(endpoint.url)) return request(endpoint);

    // Unable to perform basic authentication since client secret is missing.
    if (requiresBasicAuth(endpoint.url)) throw errors.basicAuthIsUnsupported;

    const session = await auth({ ...options, request })();
    const token = session?.token;
    if (token) endpoint.headers.authorization = "token " + token;
    return request(endpoint);
  };
}
