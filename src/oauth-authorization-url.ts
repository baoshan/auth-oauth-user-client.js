export { oauthAuthorizationUrl } from "@octokit/oauth-authorization-url";
import { ClientTypes, OAuthApp } from "./types";

export type Options<ClientType extends ClientTypes> = {
  clientType: ClientType;
  clientId: string;
  allowSignup?: boolean;
  login?: string;
  redirectUrl?: string;
  state?: string;
  baseUrl?: string;
} & (ClientType extends OAuthApp ? { scopes?: string | string[] } : {});

export type Result<ClientType extends ClientTypes> = {
  allowSignup: boolean;
  clientId: string;
  clientType: ClientType;
  login?: string;
  redirectUrl?: string;
  state: string;
  url: string;
} & (ClientType extends OAuthApp ? { scopes: string[] } : {});

declare module "@octokit/oauth-authorization-url" {
  export function oauthAuthorizationUrl<ClientType extends ClientTypes>(
    options: Options<ClientType>
  ): Result<ClientType>;
}
