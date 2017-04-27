const _get = require('lodash.get');
const extend = require('deep-extend');

module.exports.create = function (data) {
  let state = extend({}, data || {});
  let modified = false;

  function get(key, fallback) {
    return _get(state, `${key}`, fallback);
  }

  function update(change) {
    extend(state, change);
    modified = true;
  }

  return {
    get,
    fetch: () => state,
    reset: () => {
      state = {};
      modified = true;
    },
    update,

    isModified: () => modified,

    getPointer: () => get('pointer', ''),
    setPointer: pointer => update({ pointer }),

    isSilenced: () => get('silenced', false) === true,
    setSilenced: value => state.silenced = value === true,
  };
};
