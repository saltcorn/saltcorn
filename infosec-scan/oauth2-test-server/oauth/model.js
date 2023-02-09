const clients = [
  {
    clientId: "_saltcorn_client_id_",
    clientSecret: "2e85aa0c063aa97329a31fbb",
    grants: ["authorization_code"],
    redirectUris: ["http://localhost:3001/auth/callback/oauth2"],
  },
];
const tokens = [];
const authCodes = [];

const getClient = (clientId, clientSecret) => {
  return clients.find(
    (current) =>
      current.clientId === clientId &&
      (clientSecret ? current.clientSecret === clientSecret : true)
  );
};

const saveToken = (token, client, user) => {
  tokens.push({
    accessToken: token.accessToken,
    accessTokenExpiresAt: token.accessTokenExpiresAt,
    client: client,
    scope: token.scope,
    user: user,
  });
  return tokens[tokens.length - 1];
};

const getAccessToken = (token) => {
  return tokens.find((current) => current.accessToken === token);
};

const saveAuthorizationCode = (code, client, user) => {
  authCodes.push({
    authorizationCode: code.authorizationCode,
    expiresAt: code.expiresAt,
    client: client,
    redirectUri: code.redirectUri,
    user: user,
    scope: code.scope,
  });
  return authCodes[authCodes.length - 1];
};

const getAuthorizationCode = (authorizationCode) => {
  return authCodes.find(
    (current) => current.authorizationCode === authorizationCode
  );
};

const revokeAuthorizationCode = (code) => {
  const index = authCodes.findIndex(
    (current) => current.authorizationCode === code.authorizationCode
  );
  if (index >= 0) {
    authCodes.splice(index, 1);
    return true;
  } else return false;
};

const verifyScope = (token, scope) => {
  if (!token.scope) {
    return false;
  }
  const requestedScopes = scope.split(' ');
  const authorizedScopes = token.scope.split(' ');
  return requestedScopes.every(s => authorizedScopes.indexOf(s) >= 0);
};

module.exports = {
  getClient,
  saveToken,
  getAccessToken,
  saveAuthorizationCode,
  getAuthorizationCode,
  revokeAuthorizationCode,
  verifyScope,
};
