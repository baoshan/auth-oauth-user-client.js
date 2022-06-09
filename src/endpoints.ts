// TODO: no duplication between `oauth-app.js` and `auth-oauth-user-client.js`
export const endpoints = {
  createToken: ["POST", "/token"],
  checkToken: ["GET", "/token"],
  createScopedToken: ["POST", "/token/scoped"],
  resetToken: ["PATCH", "/token"],
  refreshToken: ["PATCH", "/refresh-token"],
  deleteToken: ["DELETE", "/token"],
  deleteAuthorization: ["DELETE", "/grant"],
} as const;
