/* eslint-disable arrow-body-style */
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */

const async = require('async');
const comet = require('../src'); // "comet-messenger"
const express = require('express');
const http = require('http');
const morgan = require('morgan');

/**
 * Loading example config from a config file, you don't need to do this, this is just to abstract the
 * various IDs and tokens to make this file easier to read 😉
 */
const config = require('./config');

/**
 * A static list of pages, each containing ID, token, messenger-profile & text overrides
 * For the standalone scripts including in this module, it's expected that you'll
 */
const pages = module.exports.pages = [
  {
    id: config.PAGE_ID,
    name: config.PAGE_NAME,
    token: config.PAGE_TOKEN,
    profile: {
      /**
       * get_started messenger profile options
       * https://developers.facebook.com/docs/messenger-platform/messenger-profile/get-started-button
       */
      get_started: {
        payload: JSON.stringify('GETTING_STARTED'),
      },
      /**
       * greeting messenger profile options
       * https://developers.facebook.com/docs/messenger-platform/messenger-profile/greeting-text
       */
      greeting: [
        {
          locale: 'default',
          text: 'Hello!',
        },
      ],
      /**
       * persistent_menu messenger profile options
       * https://developers.facebook.com/docs/messenger-platform/messenger-profile/persistent-menu
       */
      persistent_menu: [
        {
          locale: 'default',
          call_to_actions: [
            {
              type: 'postback',
              title: 'Reset',
              payload: JSON.stringify('GETTING_STARTED'),
            },
            {
              type: 'web_url',
              title: 'Visit our website',
              url: 'https://jdrydn.com/',
            },
          ],
        },
      ],
    },
    /**
     * Text template overrides, entirely optional, check the README for how to use this
     */
    text: {
      'WHAT_IS_YOUR_NAME': 'Hey there {{ user.first_name }}, what\'s your name?',
    },
  },
];

/**
 * A schema represents the entire conversation, and the state transitions that will occur.
 * If you imagine this conversation as a finite state machine, each step is a pointer and depending on its input will
 *   be matched to a specific function with the intent of moving the conversation forwards.
 * The schema represents each stage of the conversation, mapping the current state to a function to be executed.
 */
const schema = comet.createSchema();

/**
 * In Messenger, a postback occurs when a user clicks a button, which can fortunately be the start of the conversation
 *   (thanks to that get_started messenger-profile option 😉) so you can set a state for this new user right away!
 */
schema.onPostback('GETTING_STARTED', function ({ payload, state, send, text, user }) {
  state.reset(); // This exists to wipe the state, in case one already exists
  state.setPointer('GETTING_STARTED_SENT'); // setPointer will mean the

  return send([
    `Hey there ${user.first_name}!`,
    {
      type: 'text',
      text: text('HIGH_FIVE_REQUEST', 'How about a high-five?', { user }),
      messenger_buttons: [
        {
          type: 'postback',
          title: '✋',
          payload: JSON.stringify('RECEIVE_HIGH_FIVE'),
        },
        {
          type: 'postback',
          title: 'Nah',
          payload: JSON.stringify('REJECTED_HIGH_FIVE'),
        },
      ],
    },
  ]);
});

/**
 * Once a state has been set, you can start to create functions to execute for random user-inputted text.
 * Usually handling this is very difficult, so this module tries to make that as painless as possible by splitting up
 *   the free-form text into smaller functions where the potential free-form input is very direct & predictable.
 * If you were expecting crazy natural-language magic, sorry to disappoint!
 */
schema.onInput('GETTING_STARTED_SENT', function ({ send }) {
  return send([
    'Hmm, I didn\'t quite understand that 🙁',
    {
      type: 'text',
      text: 'How about that high-five?',
      messenger_buttons: [
        {
          type: 'postback',
          title: '✋',
          payload: JSON.stringify('RECEIVE_HIGH_FIVE'),
        },
        {
          type: 'postback',
          title: 'Nah',
          payload: JSON.stringify('REJECTED_HIGH_FIVE'),
        },
      ],
    },
  ]);
});

/**
 * In the event a state isn't matched to free-flowing text, there is a way to set a catchall function, where you can
 *   assign a new state and salvage this situation.
 */
schema.catchInput(function ({ send }) {
  return send([
    'Hmm, I didn\'t quite understand that 🙁',
    {
      type: 'text',
      text: 'How about that high-five?',
      messenger_buttons: [
        {
          type: 'postback',
          title: '✋',
          payload: JSON.stringify('RECEIVE_HIGH_FIVE'),
        },
        {
          type: 'postback',
          title: 'Nah',
          payload: JSON.stringify('REJECTED_HIGH_FIVE'),
        },
      ],
    },
  ]);
});

/**
 * Postback functions can be triggered anytime, so it's important to make sure any unexpected postback requests reset
 *   the state to a known state.
 */

schema.onPostback('RECEIVE_HIGH_FIVE', function ({ payload, state, send, text, user }) {
  state.setPointer('GETTING_STARTED_SENT');

  return send({
    type: 'image',
    src: 'http://media.giphy.com/media/14rRtgywkOitDa/giphy.gif',
  });
});

schema.onPostback('REJECTED_HIGH_FIVE', function ({ payload, state, send, text, user }) {
  state.setPointer('GETTING_STARTED_SENT');

  return send({
    type: 'text',
    text: 'Oh, ok thanks anyway..',
  });
});

/**
 * A worker represents an instance to process the worker
 * In this limited example, rather than use something sensible like:
 * - A Redis pub/sub
 * - Kue (https://npm.im/kue) or similar
 * - Amazon SQS
 * - Another thread, y'know?
 * This is just going to use an Async (https://npm.im/async) queue. Sorry.
 */
const worker = comet.createWorker({ pages, schema });
const queue = async.queue((payload, callback) => {
  worker.process(payload).then(() => callback()).catch(err => callback(err));
});

/**
 * A router represents a single webhook, connected to a Facebook app, that receives requests for pages.
 * At the moment only Express routers are supported, but there's plenty of room for other popular Node API frameworks.
 */
const router = comet.createExpressRouter({
  pages,
  queue: payloads => queue.push(payloads),

  // app_id: config.APP_ID,
  app_secret: config.APP_SECRET,
  verify_token: config.VERIFY_TOKEN,
});

/**
 * Below this point is just a standard Express HTTP server
 */
const server = http.createServer((() => {
  const app = express();
  app.use(morgan('tiny'));
  app.use(router);
  return app;
})());

server.on('error', function (err) {
  if (err.syscall === 'listen') switch (err.code) {
    case 'EACCES':
      err.message = 'HTTP port requires elevated privileges';
      break;
    case 'EADDRINUSE':
      err.message = 'HTTP port is already in use';
      break;
  }
  throw err;
});

server.on('listening', function () {
  console.log('Comet-Messenger bot listening on %s:%d', server.address().address, server.address().port);
  console.log(pages.map(page => `- ${page.name}`).join('\n'));
});

if (module.parent) {
  module.exports = { pages, schema, worker, router };
} else {
  server.listen(process.env.PORT || 3000, process.env.HOST || 'localhost');
}
