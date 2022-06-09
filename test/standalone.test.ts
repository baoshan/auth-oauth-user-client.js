import { request } from "@octokit/request";
import fetchMock from "fetch-mock";
import MockDate from "mockdate";
import { createOAuthUserClientAuth } from "../src/index";

const replaceState = jest
  .fn()
  .mockImplementation((_stateObject: any, _title: any, url: string) => {
    Object.assign(global, { location: new URL(url) });
  });

describe("standalone tests under node environment", () => {
  // jsdom does not support redirect.
  beforeEach(() => {
    Object.assign(global, {
      history: { replaceState },
      location: new URL("http://acme.com/search?q=octocat&sort=date"),
    });
  });

  afterEach(() => {
    // @ts-ignore
    delete global.location;
    jest.clearAllMocks();
  });

  it("oauth app does not support token expiration", async () => {
    expect(() =>
      createOAuthUserClientAuth({
        clientId: "clientId123",
        clientType: "oauth-app",
        // @ts-ignore
        expirationEnabled: true,
      })
    ).toThrow(
      "[@octokit/auth-oauth-user-client.js] OAuth App does not support token expiration."
    );
  });

  //#region Get Token

  it("get token (without session/state stores)", async () => {
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore: false,
      stateStore: false,
    });
    expect(await auth({ type: "getToken" })).toBeNull();
  });

  it("get token (without cached session)", async () => {
    const authStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore,
    });

    expect(await auth({ type: "getToken" })).toBeNull();
    expect(await auth({ type: "getToken" })).toBeNull();
    expect(authStore.get.mock.calls.length).toBe(2);
  });

  it("get token (with cached session)", async () => {
    const oldAuth = { token: "token123" };
    const authStore = {
      get: jest.fn().mockResolvedValue(oldAuth),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore,
    });
    expect(await auth({ type: "getToken" })).toBe(oldAuth);
    expect(await auth({ type: "getToken" })).toBe(oldAuth);
    expect(authStore.get.mock.calls.length).toBe(1);
  });

  it("get token (not expired)", async () => {
    const oldAuth = {
      token: "token123",
      expiresAt: "2000-01-03T00:00:00.000Z",
      refreshToken: "refreshToken123",
    };

    const authStore = {
      get: jest.fn().mockResolvedValueOnce(oldAuth),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "github-app",
      expirationEnabled: true,
      authStore,
    });

    MockDate.set("2000-01-02T00:00:00.000Z");
    expect(await auth({ type: "getToken" })).toEqual(oldAuth);
    expect(authStore.get.mock.calls.length).toBe(1);
    MockDate.reset();
  });

  it("get token (expired)", async () => {
    const oldAuth = {
      token: "token123",
      expiresAt: "2000-01-01T00:00:00.000Z",
      refreshToken: "refreshToken123",
    };

    const response = {
      authentication: {
        token: "token456",
        expiresAt: "2000-02-01T00:00:00.000Z",
        refreshToken: "refreshToken456",
      },
    };

    const authStore = {
      get: jest.fn().mockResolvedValueOnce(oldAuth),
      set: jest.fn(async (auth) => {
        expect(auth).toEqual(response.authentication);
      }),
    };

    const fetch = fetchMock
      .sandbox()
      .patchOnce("http://acme.com/api/github/oauth/refresh-token", response, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          "content-type": "application/json; charset=utf-8",
        },
        body: { refreshToken: "refreshToken123" },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "github-app",
      authStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    MockDate.set("2000-01-02T00:00:00.000Z");
    expect(await auth({ type: "getToken" })).toEqual(response.authentication);
    expect(authStore.get.mock.calls.length).toBe(1);
    expect(authStore.set.mock.calls.length).toBe(1);
    MockDate.reset();
  });

  it("get token (with code & state)", async () => {
    const href =
      "http://acme.com/search?q=octocat&sort=date&code=code&state=state";
    Object.assign(global, { location: new URL(href) });

    const response = {
      authentication: {
        token: "token456",
        expiresAt: "2000-02-01T00:00:00.000Z",
        refreshToken: "refreshToken123",
      },
    };

    const fetch = fetchMock
      .sandbox()
      .postOnce("http://acme.com/api/github/oauth/token", response, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          "content-type": "application/json; charset=utf-8",
        },
        body: {
          code: "code",
          redirectUrl: "http://acme.com/search?q=octocat&sort=date",
          state: "state",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "oauth-app",
      authStore: { get: async () => null, set: async () => {} },
      stateStore: { get: async () => "state", set: async () => {} },
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "getToken" })).toEqual(response.authentication);
    // expect(replaceState.mock.calls.length).toBe(1);
    expect(location.href).toBe("http://acme.com/search?q=octocat&sort=date");
  });

  //#endregion

  //#region Sign In

  it("sign in", async () => {
    const authStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockImplementation(() => {}),
    };
    const stateStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockImplementation(() => {}),
    };
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore,
      stateStore,
    });
    await auth({ type: "signIn" });
    expect(
      location.href.startsWith("https://github.com/login/oauth/authorize")
    ).toBe(true);
    expect(authStore.get.mock.calls.length).toBe(0);
    expect(authStore.set.mock.calls.length).toBe(1);
    expect(authStore.set.mock.calls[0][0]).toBe(null);
    expect(stateStore.get.mock.calls.length).toBe(0);
    expect(stateStore.set.mock.calls.length).toBe(1);
    expect(stateStore.set.mock.calls[0][0]).toBe(
      new URL(location.href).searchParams.get("state")
    );
  });

  it("sign in (without session/state stores)", async () => {
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "github-app",
      expirationEnabled: true,
      authStore: false,
      stateStore: false,
    });
    await auth({ type: "signIn" });
    expect(
      location.href.startsWith("https://github.com/login/oauth/authorize")
    ).toBe(true);
  });

  it("sign in (specified scopes)", async () => {
    const authStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(async () => {}),
    };
    const stateStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(async () => {}),
    };
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "oauth-app",
      authStore,
      stateStore,
    });
    await auth({ type: "signIn", scopes: ["abc", "def"] });
    expect(
      location.href.startsWith("https://github.com/login/oauth/authorize")
    ).toBe(true);
    expect(new URL(location.href).searchParams.get("scope")).toBe("abc,def");
  });

  it("sign in (default scopes)", async () => {
    const authStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(async () => {}),
    };
    const stateStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(async () => {}),
    };
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "oauth-app",
      authStore,
      stateStore,
      defaultScopes: ["abc", "def"],
    });
    await auth({ type: "signIn" });
    expect(
      location.href.startsWith("https://github.com/login/oauth/authorize")
    ).toBe(true);
    expect(new URL(location.href).searchParams.get("scope")).toBe("abc,def");
  });

  //#endregion

  //#region Create Token

  it("create token", async () => {
    const href =
      "http://acme.com/search?q=octocat&sort=date&code=code&state=state";
    Object.assign(global, { location: new URL(href) });

    const stateStore = {
      get: jest.fn().mockResolvedValue("state"),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const response = { authentication: { token: "token456" } };

    const fetch = fetchMock
      .sandbox()
      .postOnce("http://acme.com/api/github/oauth/token", response, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          "content-type": "application/json; charset=utf-8",
        },
        body: {
          code: "code",
          redirectUrl: "http://acme.com/search?q=octocat&sort=date",
          state: "state",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore: false,
      stateStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "createToken" })).toEqual(
      response.authentication
    );
    expect(stateStore.get.mock.calls.length).toBe(1);
    expect(stateStore.set.mock.calls.length).toBe(1);
    expect(stateStore.set.mock.calls[0][0]).toBeNull();
    expect(replaceState.mock.calls.length).toBe(1);
    expect(location.href).toBe("http://acme.com/search?q=octocat&sort=date");
  });

  it("create token (missing code)", async () => {
    const href = "http://acme.com/search?q=octocat&sort=date&state=state";
    Object.assign(global, { location: new URL(href) });
    const auth = createOAuthUserClientAuth({ clientId: "clientId123" });

    await expect(
      async () => await auth({ type: "createToken" })
    ).rejects.toThrow(
      '[@octokit/auth-oauth-user-client.js] Both "code" & "state" parameters are required.'
    );
  });

  it("create token (missing state)", async () => {
    const href = "http://acme.com/search?q=octocat&sort=date&code=code";
    Object.assign(global, { location: new URL(href) });
    const auth = createOAuthUserClientAuth({ clientId: "clientId123" });

    await expect(
      async () => await auth({ type: "createToken" })
    ).rejects.toThrow(
      '[@octokit/auth-oauth-user-client.js] Both "code" & "state" parameters are required.'
    );
  });

  it("create token (state mismatch)", async () => {
    const href =
      "http://acme.com/search?q=octocat&sort=date&code=code&state=state";
    Object.assign(global, { location: new URL(href) });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      stateStore: { get: async () => "mismatch", set: async () => {} },
    });

    await expect(
      async () => await auth({ type: "createToken" })
    ).rejects.toThrow("[@octokit/auth-oauth-user-client.js] State mismatch");
  });

  it("create token (without session/state store)", async () => {
    const href =
      "http://acme.com/search?q=octocat&sort=date&code=code&state=state";
    Object.assign(global, { location: new URL(href) });
    const response = { authentication: { token: "token123" } };

    const fetch = fetchMock
      .sandbox()
      .postOnce("http://acme.com/api/github/oauth/token", response, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          "content-type": "application/json; charset=utf-8",
        },
        body: {
          code: "code",
          redirectUrl: "http://acme.com/search?q=octocat&sort=date",
          state: "state",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore: false,
      stateStore: false,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "createToken" })).toEqual(
      response.authentication
    );
    expect(await auth()).toEqual(response.authentication);
    expect(replaceState.mock.calls.length).toBe(1);
    expect(location.href).toBe("http://acme.com/search?q=octocat&sort=date");
  });

  //#endregion

  //#region Check Token

  it("check token (unauthorized)", async () => {
    const authStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore,
    });

    await expect(
      async () => await auth({ type: "checkToken" })
    ).rejects.toThrow("[@octokit/auth-oauth-user-client.js] Unauthorized.");
    expect(authStore.get.mock.calls.length).toBe(1);
    expect(authStore.set.mock.calls.length).toBe(0);
  });

  it("check token", async () => {
    const oldAuth = { token: "token123" };
    const response = { authentication: { token: "token123" } };

    const authStore = {
      get: jest.fn().mockResolvedValue(oldAuth),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .getOnce("http://acme.com/api/github/oauth/token", response, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "checkToken" })).toEqual(response.authentication);
    expect(authStore.get.mock.calls.length).toBe(1);
    expect(authStore.set.mock.calls.length).toBe(1);
    expect(authStore.set.mock.calls[0][0]).toEqual(response.authentication);
  });

  //#endregion

  it("create scoped token", async () => {
    const oldAuth = { token: "token123" };
    const response = { authentication: { token: "token456" } };

    const authStore = {
      get: jest.fn().mockResolvedValue(oldAuth),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .postOnce("http://acme.com/api/github/oauth/token/scoped", response, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "github-app",
      authStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "createScopedToken" })).toEqual(
      response.authentication
    );
    expect(authStore.get.mock.calls.length).toBe(1);
    expect(authStore.set.mock.calls.length).toBe(1);
    expect(authStore.set.mock.calls[0][0]).toEqual(response.authentication);
  });

  it("refresh token (refresh token missing)", async () => {
    const oldAuth = { token: "token123" };

    const authStore = {
      get: jest.fn().mockResolvedValue(oldAuth),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "github-app",
      expirationEnabled: true,
      authStore,
    });

    await expect(async () => auth({ type: "refreshToken" })).rejects.toThrow(
      "[@octokit/auth-oauth-user-client.js] Refresh token missing."
    );
  });

  it("refresh token expired", async () => {
    const oldAuth = {
      refreshToken: "refresh_token_123",
      expiresAt: "2000-01-01T00:00:00.000Z",
      refreshTokenExpiresAt: "2000-01-02T00:00:00.000Z",
      token: "token123",
    };

    const authStore = {
      get: jest.fn().mockResolvedValue(oldAuth),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "github-app",
      expirationEnabled: true,
      authStore,
    });

    expect(await auth()).toEqual(null);
  });

  it("refresh token", async () => {
    const oldAuth = {
      refreshToken: "refresh_token_123",
      expiresAt: "3000-01-03T00:00:00.000Z",
      refreshTokenExpiresAt: "3000-01-03T00:00:00.000Z",
      token: "token123",
    };
    const response = {
      authentication: {
        refreshToken: "refresh_token_456",
        expiresAt: "3001-01-03T00:00:00.000Z",
        refreshTokenExpiresAt: "3001-01-03T00:00:00.000Z",
        token: "token456",
      },
    };

    const authStore = {
      get: jest.fn().mockResolvedValue(oldAuth),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .patchOnce("http://acme.com/api/github/oauth/refresh-token", response, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
          "content-type": "application/json; charset=utf-8",
        },
        body: { refreshToken: "refresh_token_123" },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "github-app",
      expirationEnabled: true,
      authStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "refreshToken" })).toEqual(
      response.authentication
    );
    expect(authStore.get.mock.calls.length).toBe(1);
    expect(authStore.set.mock.calls.length).toBe(1);
    expect(authStore.set.mock.calls[0][0]).toEqual(response.authentication);
  });

  it("reset token", async () => {
    const oldAuth = { token: "token123" };
    const response = { authentication: { token: "token456" } };

    const authStore = {
      get: jest.fn().mockResolvedValue(oldAuth),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .patchOnce("http://acme.com/api/github/oauth/token", response, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "resetToken" })).toEqual(response.authentication);
    expect(authStore.get.mock.calls.length).toBe(1);
    expect(authStore.set.mock.calls.length).toBe(1);
    expect(authStore.set.mock.calls[0][0]).toEqual(response.authentication);
  });

  it("delete token", async () => {
    const oldAuth = { token: "token123" };

    const authStore = {
      get: jest.fn().mockResolvedValue(oldAuth),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .deleteOnce("http://acme.com/api/github/oauth/token", 200, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "deleteToken" })).toBeNull();
    expect(authStore.get.mock.calls.length).toEqual(1);
    expect(authStore.set.mock.calls.length).toEqual(1);
    expect(authStore.set.mock.calls[0][0]).toBeNull();
  });

  it("delete token (offline)", async () => {
    const oldAuth = { token: "token123" };

    const authStore = {
      get: jest.fn().mockResolvedValue(oldAuth),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore,
    });

    expect(await auth({ type: "deleteToken", offline: true })).toBeNull();
    expect(authStore.get.mock.calls.length).toEqual(0);
    expect(authStore.set.mock.calls.length).toEqual(1);
    expect(authStore.set.mock.calls[0][0]).toBeNull();
  });

  it("delete authorization", async () => {
    const oldAuth = { token: "token123" };

    const authStore = {
      get: jest.fn().mockResolvedValue(oldAuth),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .deleteOnce("http://acme.com/api/github/oauth/grant", 200, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "deleteAuthorization" })).toBeNull();
    expect(authStore.get.mock.calls.length).toEqual(1);
    expect(authStore.set.mock.calls.length).toEqual(1);
    expect(authStore.set.mock.calls[0][0]).toBeNull();
  });

  it("keeps refresh token", async () => {
    const oldAuth = {
      token: "token123",
      expiresAt: "3000-01-03T00:00:00.000Z",
      refreshToken: "refreshToken123",
      refreshTokenExpiresAt: "3000-01-03T00:00:00.000Z",
    };
    const response = { authentication: { token: "token456" } };

    const authStore = {
      get: jest.fn().mockResolvedValue(oldAuth),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .patchOnce("http://acme.com/api/github/oauth/token", response, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      authStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "resetToken" })).toEqual({
      token: "token456",
      expiresAt: "3000-01-03T00:00:00.000Z",
      refreshToken: "refreshToken123",
      refreshTokenExpiresAt: "3000-01-03T00:00:00.000Z",
    });
    expect(authStore.get.mock.calls.length).toBe(1);
    expect(authStore.set.mock.calls.length).toBe(1);
    expect(await auth()).toEqual({
      token: "token456",
      expiresAt: "3000-01-03T00:00:00.000Z",
      refreshToken: "refreshToken123",
      refreshTokenExpiresAt: "3000-01-03T00:00:00.000Z",
    });
  });
});
