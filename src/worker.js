const debug = require('debug')('Comet:Worker');

const facebook = require('./lib/facebook-api');
const messageFactory = require('./lib/messages');

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
      }
      if (typeof fn !== 'function') throw new Error(`Unknown type for payload: ${JSON.stringify(payload)}`);

      const req = {
        page, payload, // eslint-disable-line object-property-newline
        meta: {}, // Create a meta object, which will be returned at the end, for logging etc.
        send: createSend({ page, user_id }), // Create a simplified send function to make this easy
      };

      // Run the before functions in parallel
      const beforeFns = schema._getFunction('before');
      if (beforeFns) await Promise.all(beforeFns.map(bfn => bfn(req)));

      debug(JSON.stringify(req));

      if (req.pointer && payload.type === 'input') {
        fn = schema._getFunction(`input.${req.pointer}`);
        if (typeof fn !== 'function') throw new Error(`Missing input function for state "${req.pointer}"`);
      }

      // run relevant function
      await fn(req);

      // Run the after functions in parallel
      const afterFns = schema._getFunction('after');
      if (afterFns) await Promise.all(afterFns.map(afn => afn(req)));

      return req.meta;
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
