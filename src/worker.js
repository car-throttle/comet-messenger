const debug = require('debug')('Comet:Worker');

const facebook = require('./lib/facebook-api');
const messageFactory = require('./lib/messages');
const stateFactory = require('./lib/state');
const utils = require('./lib/utils');

module.exports = function createWorker({ pages, schema }) {
  const pages_lookup = {};
  pages.forEach(page => {
    if (!page || !page.id || !page.token) throw new Error('Invalid page passed to worker');
    pages_lookup[`${page.id}`] = page;
  });

  return {
    async process(payload) {
      if (!payload || !payload.type || !payload.page_id || !payload.user_id) {
        throw new Error(`Invalid payload: ${JSON.stringify(payload)}`);
      }

      const page = pages_lookup[`${payload.page_id}`];
      if (!page) throw new Error(`Unknown page for payload: ${JSON.stringify(payload)}`);

      const { type, user_id } = payload;

      // If this is a postback item, format it for consistency
      if (type === 'postback' && typeof payload.postback === 'string') {
        payload.postback = { trigger: `${payload.postback}` };
      }

      // If postback, do we have a relevant function?
      let fn = null;
      switch (type) {
        case 'postback':
          fn = schema._getFunction(`postback.${payload.postback.trigger}`);
          if (typeof fn !== 'function') throw new Error(`Missing postback function for "${payload.postback.trigger}"`);
          break;
        case 'input':
          fn = schema._getFunction('input._catch') || function () { /* NOOP */ };
          break;
        case 'silenced':
          fn = forceSilenced;
      }
      if (typeof fn !== 'function') throw new Error(`Unknown type for payload: ${JSON.stringify(payload)}`);

      // in parallel, get user and state
      const [ state, user ] = await Promise.all([
        getState({ schema, page, user_id }), getUser({ schema, page, user_id })
      ]);

      debug(JSON.stringify({ payload, state: state.fetch(), user }));

      if (state.isSilenced()) {
        // If the user has been SILENCED, no more communication should happen
        // Unless they initated a GETTING_STARTED
        if (!payload.postback || payload.postback.trigger !== 'GETTING_STARTED') return Promise.resolve();
      }

      if (state.getPointer() && payload.type === 'input') {
        fn = schema._getFunction(`input.${state.getPointer()}`);
        if (typeof fn !== 'function') throw new Error(`Missing input function for state "${state.getPointer()}"`);
      }

      const meta = {};

      // run relevant function
      await fn({
        meta, page, payload, state, user, // eslint-disable-line object-property-newline
        // Create a simplified send function to make this easy
        send: createSend({ page, user_id }),
        // And don't forget
        text: createText({ page }),
      });

      if (state.isModified()) await saveState({ schema, page, state: state.fetch(), user_id });

      return meta;
    },
  };
};

function createSend({ page, user_id }) {
  const { token } = page;
  if (!token || !user_id) throw new Error('Missing page.token/user_id');

  return async function (messages) {
    messages = (Array.isArray(messages) ? messages : [ messages ]).map(messageFactory.toMessage);
    for (const message of messages) {
      await facebook.send({ access_token: token, message, user_id }); // eslint-disable-line no-await-in-loop
    }
  };
}

function createText({ page }) {
  return (...args) => utils.formatText(page.text || {}, ...args);
}

async function getState({ schema, page, user_id }) {
  const fn = schema._getFunction('getUserState');
  const data = (typeof fn === 'function') ? await fn({ page, user_id }) : schema._getDefaultState();
  const state = stateFactory.create(data);
  return state;
}

function forceSilenced({ state }) {
  state.setSilenced(true);
}

function saveState({ schema, page, state, user_id }) {
  const fn = schema._getFunction('setUserState');
  if (typeof fn !== 'function') return Promise.resolve();

  return fn({ page, state, user_id });
}

async function getUser({ schema, page, user_id }) {
  const fn = schema._getFunction('getUserProfile');
  const user = await fn({ page, user_id });
  return user;
}
