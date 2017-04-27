module.exports = function createSchema() {
  const functions = {};

  function _getFunction(ref) {
    return functions[`${ref}`];
  }
  function _setFunction(ref, fn) {
    if (typeof fn !== 'function') throw new Error(`Invalid argument for function for ${ref}`);
    functions[`${ref}`] = fn;
  }

  return {
    _getFunction,

    catchInput: fn => _setFunction('input._catch', fn),
    onInput: (handle, fn) => _setFunction(`input.${handle}`, fn),
    onPostback: (handle, fn) => _setFunction(`postback.${handle}`, fn),

    before(fn) {
      if (typeof fn !== 'function') throw new Error('Invalid argument for before fn');
      functions.before = (functions.before || []).concat(fn);
    },
    after(fn) {
      if (typeof fn !== 'function') throw new Error('Invalid argument for after fn');
      functions.after = (functions.after || []).concat(fn);
    },
  };
};
