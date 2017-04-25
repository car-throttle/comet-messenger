const facebook = require('./lib/facebook-api');

module.exports = function createSchema() {
  const functions = {};

  function _getFunction(ref) {
    return functions[`${ref}`];
  }
  function _hasFunction(ref) {
    return typeof functions[`${ref}`] === 'function';
  }
  function _setFunction(ref, fn) {
    if (typeof fn !== 'function') throw new Error(`Invalid argument for function for ${ref}`);
    functions[`${ref}`] = fn;
  }

  /**
   * By default, always make a request to Facebook
   */
  _setFunction('getUserProfile', function ({ page, user_id }) {
    return facebook.getUserProfile({ access_token: page.token, user_id });
  });

  return {
    _getFunction,
    _hasFunction,

    catchInput: fn => _setFunction('input._catch', fn),
    onInput: (handle, fn) => _setFunction(`input.${handle}`, fn),
    onPostback: (handle, fn) => _setFunction(`postback.${handle}`, fn),
    getUserProfile: fn => _setFunction('getUserProfile', fn),
    getUserState: fn => _setFunction('getUserState', fn),
    setUserState: fn => _setFunction('setUserState', fn),
  };
};
