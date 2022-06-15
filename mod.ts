import type {
  GitHubAppAuthentication,
  OAuthAppAuthentication,
} from "@octokit/auth-oauth-user";

import type {
  EndpointDefaults,
  EndpointOptions,
  OctokitResponse,
  RequestInterface,
  RequestParameters,
  Route,
} from "@octokit/types";

import { oauthAuthorizationUrl } from "@octokit/oauth-authorization-url";

/*
## Types

An `AuthStrategy` is a function that takes a single parameter of type
`AuthStrategyOptions`  and returns an `Authenticator`. An `Authenticator` is
also a function (with state of type `AuthenticatorState`) that takes an
`AuthenticatorMethods` and returns an `Auth` with `token`.
*/

type ClientTypes = OAuthApp | GitHubApp;
export type OAuthApp = "oauth-app";
export type GitHubApp = "github-app";

/**
 * A generic version of `AuthInterface` defined in [@octokit/types.ts][1]
 * [1]: https://github.com/octokit/types.ts/blob/master/src/AuthInterface.ts
 *
 * > Interface to implement complex authentication strategies for Octokit.
 *   An object Implementing the AuthInterface can directly be passed as the
 *   `auth` option in the Octokit constructor.
 *
 * > For the official implementations of the most common authentication
 *   strategies, see https://github.com/octokit/auth.js
 */
export interface AuthStrategy<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> {
  (
    method?: AuthenticatorMethods<ClientType, ExpirationEnabled>,
  ): Promise<Auth<ClientType, ExpirationEnabled> | null>;

  hook<T = unknown>(
    request: RequestInterface,
    route: Route | EndpointOptions,
    parameters?: RequestParameters,
  ): Promise<OctokitResponse<T>>;
}

/**
 * Supported methods of a created client authentication strategy:
 *
 * 1. Get token
 * 2. [Sign in](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#1-request-a-users-github-identity)
 * 3. [Create an app token](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github)
 * 4. [Check a token](https://docs.github.com/en/rest/reference/apps#check-a-token)
 * 5. [Create a scoped access token](https://docs.github.com/en/rest/reference/apps#create-a-scoped-access-token)
 * 6. [Reset a token](https://docs.github.com/en/rest/reference/apps#reset-a-token)
 * 7. [Renewing a user token with a refresh token](https://docs.github.com/en/developers/apps/building-github-apps/refreshing-user-to-server-access-tokens#renewing-a-user-token-with-a-refresh-token)
 * 8. [Delete an app token](https://docs.github.com/en/rest/reference/apps#delete-an-app-token) (sign out)
 * 9. [Delete an app
 *    authorization](https://docs.github.com/en/rest/reference/apps#delete-an-app-authorization)
 */
export type AuthenticatorMethods<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> =
  | { type: "getToken" }
  | (
    & {
      type: "signIn";
      login?: string;
      allowSignup?: boolean;
    }
    & (ClientType extends OAuthApp ? { scopes?: string[] }
      : Record<never, never>)
  )
  | { type: "createToken" }
  | { type: "checkToken" }
  | (ClientType extends OAuthApp ? { type: "createScopedToken" } : never)
  | { type: "resetToken" }
  | (ExpirationEnabled extends true ? { type: "renewToken" } : never)
  | { type: "deleteToken"; offline?: boolean }
  | { type: "deleteAuthorization" };

/**
 * Authentication object returned from [`@octokit/oauth-app.js`][1].
 *
 * [1]: https://github.com/octokit/oauth-app.js
 */
export type Auth<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> =
  & (ExpirationEnabled extends true ? {
    expiresAt: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
  }
    : Record<never, never>)
  & Omit<
    (ClientType extends OAuthApp ? OAuthAppAuthentication
      : GitHubAppAuthentication),
    "clientSecret"
  >;

/**
 * State of an authenticator. Missing options have default values.
 */
type AuthenticatorState<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> = Required<AuthStrategyOptions<ClientType, ExpirationEnabled>>;

/** Options to create an authenticator. */
export type AuthStrategyOptions<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> =
  & MandatoryAuthStrategyOptions<ClientType, ExpirationEnabled>
  & Partial<OptionalAuthStrategyOptions<ClientType, ExpirationEnabled>>;

/** Mandatory options to create an authenticator. */
type MandatoryAuthStrategyOptions<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> = {
  clientId: string;
  clientType: ClientType;
  expirationEnabled: ExpirationEnabled;
};

/** Optional options to create an authenticator. */
type OptionalAuthStrategyOptions<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> = {
  // generic properties
  auth: Auth<ClientType, ExpirationEnabled> | null;
  authStore: Store<Auth<ClientType, ExpirationEnabled>> | false;
  defaultScopes: ClientType extends OAuthApp ? string[] : never;

  // non-generic properties
  location: Location;
  fetch: typeof fetch;
  serviceOrigin: string;
  servicePathPrefix: string;
  stateStore: Store<string> | false;
};

/**
 * Generic store to persist authentication object or oauth `state` for [web
 * application flow][1].
 *
 * [1]: https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow
 */
export type Store<T> = {
  get: () => T | null | Promise<T | null>;
  set: (value: T | null) => void | Promise<void>;
};

// TODO: making @octokit/oauth-authorization-url generic
type OAuthAuthorizationUrlOptions<ClientType extends ClientTypes> =
  & {
    clientType: ClientType;
    clientId: string;
    allowSignup?: boolean;
    login?: string;
    redirectUrl?: string;
    state?: string;
    baseUrl?: string;
  }
  & (ClientType extends OAuthApp ? { scopes?: string | string[] }
    : Record<never, never>);

type OAuthAuthorizationUrlResult<ClientType extends ClientTypes> = {
  allowSignup: boolean;
  clientId: string;
  clientType: ClientType;
  login?: string;
  redirectUrl?: string;
  state: string;
  url: string;
} & (ClientType extends OAuthApp ? { scopes: string[] } : Record<never, never>);

declare module "@octokit/oauth-authorization-url" {
  function oauthAuthorizationUrl<ClientType extends ClientTypes>(
    options: OAuthAuthorizationUrlOptions<ClientType>,
  ): OAuthAuthorizationUrlResult<ClientType>;
}

/* ## Metadata */
export const NAME = "@octokit/auth-oauth-user-client.js";
export const VERSION = "0.1.0";

/* ## Authentication Strategy */
export const createOAuthUserClientAuth = <
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
>(
  options: AuthStrategyOptions<ClientType, ExpirationEnabled>,
): AuthStrategy<ClientType, ExpirationEnabled> => {
  if (options.clientType === "oauth-app" && options.expirationEnabled) {
    throw Error("OAuth App does not support token expiration.");
  }

  const defaultOptions = {
    authStore: createLocalStore(`AUTH:${options.clientId}`),
    stateStore: createLocalStore(`STATE:${options.clientId}`),
    auth: null,
    ...(options.clientType === "oauth-app"
      ? { defaultScopes: [] as string[] }
      : {}),
    serviceOrigin: location.origin,
    servicePathPrefix: "/api/github/oauth",
    location,
    fetch,
  } as OptionalAuthStrategyOptions<ClientType, ExpirationEnabled>;

  const state = { ...defaultOptions, ...options };
  if (options.auth && state.authStore) state.authStore.set(options.auth);
  const _auth = auth(state);
  return Object.assign(_auth, { hook: hook(_auth) });
};

/* ## Authentication Methods */
const auth = <
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
>(
  state: AuthenticatorState<ClientType, ExpirationEnabled>,
) => {
  type Command = AuthenticatorMethods<ClientType, ExpirationEnabled>;
  const authStore = state.authStore || undefined;
  const stateStore = state.stateStore || undefined;

  const fetchAuth = async (
    type: keyof typeof endpoints,
    token: string | null,
    body: Record<string, unknown> | null,
  ) => {
    let auth = (await fetchOAuthApp(state, type, token, body))
      ?.authentication || null;
    if (auth) auth = { ...(state.auth || {}), ...auth };
    return await setAuth(auth);
  };

  const setAuth = async (
    auth: Auth<ClientType, ExpirationEnabled> | null = null,
  ) => {
    await authStore?.set(auth);
    return (state.auth = auth);
  };

  return async function auth(
    command: Command = { type: "getToken" },
  ): Promise<Auth<ClientType, ExpirationEnabled> | null> {
    const { type, ...commandOptions } = command;

    const url = new URL(state.location.href);
    const code = url.searchParams.get("code");
    const newState = url.searchParams.get("state");

    switch (type) {
      case "signIn": {
        await setAuth(); // clear local auth before redirecting
        const newState = Math.random().toString(36).substring(2);
        stateStore?.set(newState);
        const redirectUrl = oauthAuthorizationUrl<ClientType>({
          clientType: state.clientType,
          clientId: state.clientId,
          redirectUrl: state.location.href,
          state: newState,
          ...commandOptions,
        } as OAuthAuthorizationUrlOptions<ClientType>).url;
        state.location.href = redirectUrl;
        return null;
      }

      case "getToken": {
        if (!code || !newState) {
          state.auth ||= (await authStore?.get()) || null;
          if (!state.auth) return null;
          if (
            // @ts-ignore better than a one-time assertion function
            !state.auth.expiresAt || new Date(state.auth.expiresAt) > new Date()
          ) {
            return state.auth;
          }
          return await auth({ type: "renewToken" } as Command);
        }
      }

      /* falls through */

      case "createToken": {
        if (!code || !newState) {
          throw Error('Both "code" & "state" parameters are required.');
        }
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        const redirectUrl = url.href;
        // @ts-ignore mock `window.history` in tests
        window.history.replaceState({}, "", redirectUrl);
        const oldState = (await stateStore?.get());
        await stateStore?.set(null);
        if (stateStore && (newState != oldState)) {
          throw Error("State mismatch.");
        }
        return await fetchAuth("createToken", null, {
          state: newState, // TODO: this is unnecessary, update oauth-app
          code,
          redirectUrl,
        });
      }

      case "checkToken":
      case "createScopedToken":
      case "resetToken":
      case "renewToken":
      case "deleteToken":
      case "deleteAuthorization": {
        let body: Record<string, unknown> | null = null;
        if (["POST", "PUT", "PATCH"].includes(endpoints[type]?.[0])) {
          const { type: _, ..._payload } = command as Record<string, unknown>;
          body = _payload;
        }
        if (type === "deleteToken" && command.offline) return await setAuth();
        if (type === "renewToken") {
          if (state.auth) {
            const auth = state.auth as Auth<ClientType, true>;
            const renewableUntil = new Date(auth.refreshTokenExpiresAt);
            if (new Date() > renewableUntil) return await setAuth();
            body!.refreshToken = auth.refreshToken;
          }
        } else state.auth = await auth();
        if (!state.auth) throw Error("Unauthorized.");
        const { token } = state.auth; // TODO: does `renewToken` need token?
        if (type.startsWith("delete")) await setAuth();
        return await fetchAuth(type, token, body);
      }
    }
  };
};

/* ## Fetch OAuth App */
const fetchOAuthApp = async <
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
>(
  state: AuthenticatorState<ClientType, ExpirationEnabled>,
  command: keyof typeof endpoints,
  token: string | null,
  body: Record<string, unknown> | null,
) => {
  const [method, path] = endpoints[command];
  const headers: Record<string, string> = {
    "user-agent": `${NAME}/${VERSION} ${navigator.userAgent}`,
    ...(token ? { authorization: "token " + token } : {}),
    ...(body ? { "content-type": "application/json; charset=utf-8" } : {}),
    accept: "application/json",
  };
  const route = state.serviceOrigin + state.servicePathPrefix + path;
  const { fetch } = state;
  const response = await fetch(route, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return null;
  return await response.json();
};

type AnyResponse<T> = OctokitResponse<T>;

/* ## Create (Generic) Local Store */
const createLocalStore = <T>(key: string): Store<T> => {
  const _key = NAME + ":" + key;
  const _localStorage = localStorage;
  return {
    get: () => {
      const text = _localStorage.getItem(_key);
      return text ? JSON.parse(text) as T : null;
    },
    set: (value) => {
      value
        ? _localStorage.setItem(_key, JSON.stringify(value))
        : _localStorage.removeItem(_key);
    },
  };
};

/*
## OAuth App Endpoints

TODO: better defined in `oauth-app.js`?
*/
const endpoints = {
  createToken: ["POST", "/token"],
  checkToken: ["GET", "/token"],
  createScopedToken: ["POST", "/token/scoped"],
  resetToken: ["PATCH", "/token"],
  renewToken: ["PATCH", "/refresh-token"],
  deleteToken: ["DELETE", "/token"],
  deleteAuthorization: ["DELETE", "/grant"],
} as const;

/*
## Hooks

TODO: should be part of `octokit/core`?
*/
const hook = <
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
>(_auth: () => Promise<Auth<ClientType, ExpirationEnabled> | null>): <T>(
  request: RequestInterface,
  route: Route | EndpointOptions,
  parameters: RequestParameters,
) => Promise<AnyResponse<T>> => {
  return async <T>(
    request: RequestInterface,
    route: Route | EndpointOptions,
    parameters: RequestParameters = {},
  ): Promise<AnyResponse<T>> => {
    const endpoint = request.endpoint.merge(
      route as string,
      parameters,
    ) as EndpointDefaults & { url: string };

    // The following endpoints require an OAuth App to authenticate using its
    // client_id and client_secret. Unable to perform basic authentication
    // since client secret is missing.
    //
    // - [`POST /applications/{client_id}/token`](https://docs.github.com/en/rest/reference/apps#check-a-token) - Check a token
    // - [`PATCH /applications/{client_id}/token`](https://docs.github.com/en/rest/reference/apps#reset-a-token) - Reset a token
    // - [`POST /applications/{client_id}/token/scoped`](https://docs.github.com/en/rest/reference/apps#create-a-scoped-access-token) - Create a scoped access token
    // - [`DELETE /applications/{client_id}/token`](https://docs.github.com/en/rest/reference/apps#delete-an-app-token) - Delete an app token
    // - [`DELETE
    //   /applications/{client_id}/grant`](https://docs.github.com/en/rest/reference/apps#delete-an-app-authorization)
    //   - Delete an app authorization
    //
    // deprecated:
    // - [`GET /applications/{client_id}/tokens/{access_token}`](https://docs.github.com/en/rest/reference/apps#check-an-authorization) - Check an authorization
    // - [`POST /applications/{client_id}/tokens/{access_token}`](https://docs.github.com/en/rest/reference/apps#reset-an-authorization) - Reset an authorization
    // - [`DELETE /applications/{client_id}/tokens/{access_token}`](https://docs.github.com/en/rest/reference/apps#revoke-an-authorization-for-an-application) - Revoke an authorization for an application
    // - [`DELETE /applications/{client_id}/grants/{access_token}`](https://docs.github.com/en/rest/reference/apps#revoke-a-grant-for-an-application) - Revoke a grant for an application
    if (/\/applications\/[^/]+\/(token|grant)s?/.test(endpoint.url)) {
      throw Error("Basic authentication is unsupported.");
    }

    // do not intercept OAuth Web flow requests
    const oauthWebFlowUrls = /\/login\/(oauth\/access_token|device\/code)$/;
    if (!oauthWebFlowUrls.test(endpoint.url)) {
      const auth = await _auth();
      const token = auth?.token;
      if (token) endpoint.headers.authorization = "token " + token;
    }

    return request(endpoint);
  };
};
