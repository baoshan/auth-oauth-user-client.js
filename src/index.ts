import { request } from "@octokit/request";

//
import { auth } from "./auth";
import { createStore } from "./create-store";
import { errors } from "./errors";
import { hook } from "./hook";
import { userAgent, VERSION } from "./metadata";
import type {
  AuthInterface,
  ClientTypes,
  GenericAuthOptions,
  GitHubApp,
  NonGenericAuthOptions,
  OAuthApp,
  Auth,
  StrategyOptions,
  Scopes,
} from "./types";

// Create an OAuth strategy:
//
// 1. `clientType` defaults to `oauth-app`.
// 2. `expirationEnabled` defaults to `true` for GitHub App.
export const createOAuthUserClientAuth = <
  ClientType extends ClientTypes = OAuthApp,
  ExpirationEnabled extends boolean = ClientType extends GitHubApp
    ? true
    : false
>({
  clientType = "oauth-app" as ClientType,
  expirationEnabled = (clientType === "github-app") as ExpirationEnabled,
  ...options
}: StrategyOptions<ClientType, ExpirationEnabled>): AuthInterface<
  ClientType,
  ExpirationEnabled
> => {
  // Delete me once OAuth App supports token expiration.
  if (clientType === "oauth-app" && expirationEnabled) {
    throw errors.oauthAppDoesNotSupportTokenExpiration;
  }

  const defaultGenericState = {
    clientType,
    expirationEnabled,
    authStore: createStore<Auth<ClientType, ExpirationEnabled>>(
      `AUTH:${options.clientId}`
    ),
    auth: null,
    ...(clientType === "oauth-app" ? { defaultScopes: [] as string[] } : {}),
  } as GenericAuthOptions<ClientType, ExpirationEnabled>;

  const defaultScopes = (
    clientType === "oauth-app" ? { defaultScopes: [] as string[] } : {}
  ) as Scopes<ClientType>;

  const defaultNonGenericState: NonGenericAuthOptions = {
    serviceOrigin: location.origin,
    servicePathPrefix: "/api/github/oauth",
    request: request.defaults({ headers: { "user-agent": userAgent } }),
    stateStore: createStore(`STATE:${options.clientId}`),
  };

  const authOptions = Object.assign(
    defaultGenericState,
    defaultScopes,
    defaultNonGenericState,
    options
  );

  return Object.assign(auth(authOptions), { hook: hook(authOptions) });
};

createOAuthUserClientAuth.VERSION = VERSION;
