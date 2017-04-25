const _get = require('lodash.get');
const extend = require('deep-extend');

const DEFAULT_STATE = {
  pointer: '',
  silenced: false,
};

module.exports.create = function (data) {
  let state = Object.assign({}, DEFAULT_STATE, data);
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
      state = Object.assign({}, DEFAULT_STATE);
      modified = true;
    },
    update,

    isModified: () => Boolean(modified),

    getPointer: () => get(state, 'pointer', ''),
    setPointer: pointer => update({ pointer }),

    isSilenced: () => get(state, 'silenced', false) === true,
    setSilenced: value => state.silenced = value === true,
  };
};
