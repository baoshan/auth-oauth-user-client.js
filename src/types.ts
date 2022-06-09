import type {
  EndpointOptions,
  OctokitResponse,
  RequestInterface,
  RequestParameters,
  Route,
} from "@octokit/types";
import type {
  GitHubAppAuthentication,
  OAuthAppAuthentication,
} from "@octokit/auth-oauth-user";

export type ClientTypes = OAuthApp | GitHubApp;
export type OAuthApp = "oauth-app";
export type GitHubApp = "github-app";

// ## Types of Generic Parameters

// Most types and interfaces are generic around two types:
//
// 1. Client type: If it’s an OAuth App or a GitHub App.
// 2. Expiration setting: If token expiration has been enabled for the app.
//
// Although currently GitHub does not support token expiration for OAuth app,
// expiring OAuth tokens will become the norm in future. These two concepts are
// modeled orthogonally.

// Generic session object models server response.
export type Auth<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean
> = (ExpirationEnabled extends true
  ? {
      expiresAt: string;
      refreshToken: string;
      refreshTokenExpiresAt: string;
    }
  : Record<never, never>) &
  Omit<
    ClientType extends OAuthApp
      ? OAuthAppAuthentication
      : GitHubAppAuthentication,
    "clientSecret"
  >;

// ## Auth Options

// `clientId` is necessary for the `signIn` command to redirect only once
// (without relying on a `/api/github/oauth/login` endpoint.) `clientId` is
// public information which is exposed in the first step of the [web application
// OAuth flow](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow)
export type RequiredAuthOptions = { clientId: string };

// Generic state properties related to client types and expiration settings.
export type GenericAuthOptions<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean
> = {
  clientType: ClientType;
  expirationEnabled: ExpirationEnabled;
  authStore: Store<Auth<ClientType, ExpirationEnabled>> | false;
  auth: Auth<ClientType, ExpirationEnabled> | null;
};

export type Scopes<ClientType extends ClientTypes> = ClientType extends OAuthApp
  ? { defaultScopes: string[] }
  : Record<never, never>;

// Non-generic state properties for all types of apps and expiration settings.
export type NonGenericAuthOptions = {
  serviceOrigin: string; // Protocol, hostname, and port of backend services.
  servicePathPrefix: string; // Path prefix of backend services.
  stateStore: Store<string> | false;
  request: RequestInterface;
};

// Store for persisting authentication or [oauth `state` for web application
// flow](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow).
export type Store<Value> = {
  get: () => Promise<Value | null>;
  set: (value: Value | null) => Promise<void>;
};

// All properties in `Options` are non-optional although most of them
// are optional in the `StrategyOptions`.
export type Options<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean
> = RequiredAuthOptions &
  GenericAuthOptions<ClientType, ExpirationEnabled> &
  Scopes<ClientType> &
  NonGenericAuthOptions;

// Most properties are optional in `StrategyOptions`.
export type StrategyOptions<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean
> = RequiredAuthOptions &
  Partial<GenericAuthOptions<ClientType, ExpirationEnabled>> &
  Partial<Scopes<ClientType>> &
  Partial<NonGenericAuthOptions>;

// # Interface

// Supported commands of a created authentication strategy. Types are named
// using a `verb` + `noun` pattern (such as `refreshToken`) matching the
// documentation title.
//
// 1. [Sign in](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#1-request-a-users-github-identity)
// 2. Get (local) token
// 3. [Create an app token](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github)
// 4. [Check a token](https://docs.github.com/en/rest/reference/apps#check-a-token)
// 5. [Create a scoped access token](https://docs.github.com/en/rest/reference/apps#create-a-scoped-access-token)
// 6. [Reset a token](https://docs.github.com/en/rest/reference/apps#reset-a-token)
// 7. [Renewing a user token with a refresh token](https://docs.github.com/en/developers/apps/building-github-apps/refreshing-user-to-server-access-tokens#renewing-a-user-token-with-a-refresh-token)
// 8. [Delete an app token](https://docs.github.com/en/rest/reference/apps#delete-an-app-token) (sign out)
// 9. [Delete an app authorization](https://docs.github.com/en/rest/reference/apps#delete-an-app-authorization)
export type Command<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean
> =
  | {
      type: "signIn";
      login?: string;
      allowSignup?: boolean;
      scopes?: ClientType extends OAuthApp ? string[] : never;
    }
  | { type: "getToken" }
  | { type: "createToken" }
  | { type: "checkToken" }
  | (ClientType extends GitHubApp ? { type: "createScopedToken" } : never)
  | { type: "resetToken" }
  | (ExpirationEnabled extends true ? { type: "refreshToken" } : never)
  | { type: "deleteToken"; offline?: boolean }
  | { type: "deleteAuthorization" };

// Authentication strategy created via `createOAuthUserClientAuth`.
export interface AuthInterface<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean
> {
  (options?: Command<ClientType, ExpirationEnabled>): Promise<Auth<
    ClientType,
    ExpirationEnabled
  > | null>;

  hook(
    request: RequestInterface,
    route: Route | EndpointOptions,
    parameters?: RequestParameters
  ): Promise<OctokitResponse<any>>;
}
