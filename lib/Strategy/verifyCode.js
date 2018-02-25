const debug = require('debug')('zero.rverify');
const lookup = require('../utils/lookup');

const verifyCode = async (strategy, req, options) => {
  // Get token from tokenField
  const tokenField = strategy.deliver.tokenField;
  // NOTE should it be code ?
  const code = options.allowPost
    ? lookup(req.body, tokenField) || lookup(req.query, tokenField)
    : lookup(req.query, tokenField);

  debug('trying to exchange user code against a token');
  const storagePath = `/tokens/${code}`;
  // TODO fail if nothing
  const token = await strategy.storage.get(storagePath);

  // FIXME it's another value I think
  if (!token) {
    // abort with HTTP 401
    return strategy.fail();
  }

  // it only works once after registration and code delivery
  // further requests should fail here and use the real token returned
  // previously
  await strategy.storage.delete(storagePath);

  // return back the token
  // TODO lookup user as well
  // NOTE id is mandatory
  return strategy.success({ id: 0 }, { token, message: 'foo' });
};

module.exports = verifyCode;
