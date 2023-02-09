const OAuthServer = require('express-oauth-server')

module.exports = new OAuthServer({
  model: require('./model'),
  grants: ['authorization_code'],
  accessTokenLifetime: 60 * 60, // 1 hour
  allowEmptyState: true,
  allowExtendedTokenAttributes: true,
  allowBearerTokensInQueryString: true,
})
