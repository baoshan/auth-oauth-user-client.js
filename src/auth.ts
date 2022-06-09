import { errors } from "./errors";
import { oauthAuthorizationUrl } from "./oauth-authorization-url";
import { requestOAuthApp } from "./request-oauth-app";
import type { ClientTypes, Command, Options, OAuthApp, Auth } from "./types";

function isAuthExpirationEnabled<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean
>(auth: Auth<ClientType, ExpirationEnabled>): auth is Auth<ClientType, true> {
  return "expiresAt" in auth;
}

function isOptionsOAuthApp<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean
>(
  options: Options<ClientType, ExpirationEnabled>
): options is Options<ClientType, ExpirationEnabled> &
  Options<OAuthApp, ExpirationEnabled> {
  return options.clientType === "oauth-app";
}

export const auth = <
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean
>(
  options: Options<ClientType, ExpirationEnabled>
): ((
  command?: Command<ClientType, ExpirationEnabled>
) => Promise<Auth<ClientType, ExpirationEnabled> | null>) => {
  const _authStore = options.authStore || undefined;
  const _stateStore = options.stateStore || undefined;

  return async function _auth(
    command: Command<ClientType, ExpirationEnabled> = { type: "getToken" }
  ): Promise<Auth<ClientType, ExpirationEnabled> | null> {
    const { type: _, ...payload } = command as Record<string, unknown>;
    switch (command.type) {
      case "signIn": {
        // clear local session before redirecting
        options.auth = null;
        await _authStore?.set(null);
        const state = Math.random().toString(36).substring(2);
        _stateStore?.set(state);

        // redirect
        location.href = oauthAuthorizationUrl({
          clientType: options.clientType,
          clientId: options.clientId,
          redirectUrl: location.href,
          state,
          login: command.login,
          allowSignup: command.allowSignup,
          ...(isOptionsOAuthApp(options)
            ? { scopes: command.scopes || options.defaultScopes }
            : {}),
        }).url;
        return null;
      }

      case "getToken": {
        const url = new URL(location.href);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        // returns local token unless both `code` and `state` search
        // parameters are present
        if (!code || !state) {
          options.auth ||= (await _authStore?.get()) || null;
          if (!options.auth) return null;

          // auto refresh for user-to-server token
          if (!isAuthExpirationEnabled(options.auth)) return options.auth;
          const { expiresAt } = options.auth;
          if (new Date(expiresAt) > new Date()) return options.auth;

          const { refreshTokenExpiresAt } = options.auth;
          if (new Date(refreshTokenExpiresAt) <= new Date()) {
            await _authStore?.set(null);
            return null;
          }

          return await _auth({ type: "refreshToken" } as Command<
            ClientType,
            ExpirationEnabled
          >);
        }
      }

      // Exchange `code` parameter for an session using backend service.
      case "createToken": {
        const url = new URL(location.href);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        const redirectUrl = url.href;
        history.replaceState({}, "", redirectUrl);

        if (!code || !state) throw errors.codeOrStateMissing;

        // received `state` should match expected
        const expectedState = (await _stateStore?.get()) || undefined;
        await _stateStore?.set(null);
        if (expectedState && state !== expectedState)
          throw errors.stateMismatch;

        // do not fallthrough using `getToken`
        command.type = "createToken";
        Object.assign(payload, { state, code, redirectUrl });
      }

      case "checkToken":
      case "createScopedToken":
      case "resetToken":
      case "refreshToken":
      case "deleteToken":
      case "deleteAuthorization": {
        // `deleteToken` with `offline` set should never throw
        if (command.type === "deleteToken" && command.offline) {
          await _authStore?.set(null);
          return (options.auth = null);
        }

        // `createToken` doesn’t need a token while the others do
        if (command.type !== "createToken") {
          options.auth ||= await _auth();
          if (!options.auth) throw errors.unauthorized;
        }

        // payload for `refreshToken` command
        if (command.type === "refreshToken") {
          if (options.auth && isAuthExpirationEnabled(options.auth)) {
            payload.refreshToken = options.auth.refreshToken;
          } else throw errors.refreshTokenMissing;
        }

        // invoke `@octokit/oauth-app` endpoint unless delete token `offline`
        let auth: Auth<ClientType, ExpirationEnabled> | null =
          (await requestOAuthApp(options, command.type, options.auth, payload))
            .data.authentication || null;

        // `resetToken` returns no `refreshToken`, original `refreshToken`
        // and `refreshTokenExpiresAt` are kept to `refreshToken` later
        if (auth) auth = Object.assign(options.auth || {}, auth);
        await _authStore?.set(auth);
        return (options.auth = auth);
      }
    }
  };
};
