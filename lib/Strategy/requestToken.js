const debug = require('debug')('zero.request');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const lookup = require('../utils/lookup');

// https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
const randomCode = len =>
  Math.random()
    .toString(36)
    .substring(2, len);

const requestToken = async (strategy, req, options) => {
  // Get address from addressField
  const addressField = strategy.deliver.addressField;
  const address = options.allowPost
    ? lookup(req.body, addressField) || lookup(req.query, addressField)
    : lookup(req.query, addressField);

  if (!address) {
    return strategy.fail(
      new Error(options.badRequestMessage || `Missing ${addressField}`),
      400
    );
  }

  // Verify user
  const user = await strategy.verify(address).catch(err => strategy.fail(err));
  if (!user) {
    return strategy.fail(
      new Error(options.authMessage || `No user found`),
      400
    );
  }

  // Generate JWT
  const createToken = promisify(jwt.sign);
  const token = await createToken(
    { user, iat: Math.floor(Date.now() / 1000) },
    strategy.secret,
    { expiresIn: strategy.ttl }
  ).catch(err => strategy.error(err));

  // by default the code delivered is the token itself -> simpler and
  // storage-free workflow, worst UX
  let code = token;
  if (options.useCode) {
    // code workflow was configured, generate a code and hide the token inside
    // the storage for later retrieval by only authorized customer
    code = randomCode(6);
    debug(`storing user code at /tokens/${code}`);
    await strategy.storage.set(`/tokens/${code}`, token);
  }

  // Deliver JWT or code
  await strategy.deliver
    .send(user, code, req)
    .catch(err => strategy.error(err));

  // Pass without making a success or fail decision (No passport user will be set)
  // https://github.com/jaredhanson/passport/blob/master/lib/middleware/authenticate.js#L329
  return strategy.pass({ message: 'token succesfully delivered' });
};

module.exports = requestToken;
