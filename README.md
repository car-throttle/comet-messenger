# Comet-Messenger

[![NPM](https://badge.fury.io/js/comet-messenger.svg)](https://www.npmjs.com/package/comet-messenger)
![Circle CI](https://circleci.com/gh/car-throttle/comet-messenger/tree/master.svg?style=shield)
![Coverage Status](https://coveralls.io/repos/car-throttle/comet-messenger/badge.svg?branch=master&service=github)

Oembed URL expansion route for Express apps.

Node-JS microservice-oriented framework for interacting with
[Facebook Messenger](https://developers.facebook.com/products/messenger/) :sunglasses:

----

Some **important factors** to bear in mind:

- This framework makes absolutely no assumptions about your architecture, but does assume the API service will be
  attached to an Express application (happy to accept PRs for more frameworks).
- It does provide some structure for building your own messenger bots.
- `async/await` functions are used in the core, and are encouraged.
- Follows the hop naming convention: [:beers:](https://en.wikipedia.org/wiki/List_of_hop_varieties#Comet).

## Installation

```
$ npm install comet-messenger
```

If preferred you can clone directly from this repository. `master` is guaranteed to be stable, but there's no guarantee
of changes between major versions breaking existing code. [Semver](https://github.com/npm/node-semver) up, yo!

## Usage

In this framework, the concept of a bot is split into `pages`, `schema`, `router` and `worker`.

`pages` exist as an array of objects defining a page. At a minimum you will need the page ID, the name of the page, and
the page token you created on Facebook.

```json
[
  {
    "id": "24733546793321423..",
    "name": "Some Important Page",
    "token": "f03fc501fca315b369b00fc0077b5cf7.."
  }
]
```

Think of the `schema` as a conversation tree - every outcome is mapped and this is how you programmatically control
your Messenger bot. All your business logic is going to end up in here! See the [Schema](#Schema) section for more
information on the methods here and other methods you can use.

```js
const comet = require('comet-messenger');
const schema = comet.createSchema();

/**
 * In Messenger, a postback occurs when a user clicks a button.
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
 * Once a state has been set, free-form input can be accurately handled!
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
```

The `router` is the API router that the
[Facebook webhook](https://developers.facebook.com/docs/messenger-platform/webhook-reference) will hit. It takes
messages sent from Facebook and pushes the messages onto your preferred queue stack. This example assumes you'll be
dropping it into an existing Express application and using [async](https://npm.im/async) for your queue. The router
requires your Facebook app secret & the verify token that you specified when setting up that Facebook webhook :wink:

```js
const async = require('async');
const comet = require('comet-messenger');
const pages = [ ... ]; // The array of pages from above, for example

const queue = async.queue((payload, callback) => { ... });

app.use('/api/fb-messenger-bots', comet.createExpressRouter({
  /**
   * Your list of Facebook pages
   */
  pages,

  /**
   * A function which accepts a Promise in return, so you can push messages onto your preferred queue stack.
   * Since this function is wrapped around an await call, it doesn't matter if this function is asynchronous or not.
   *
   * @param Array payloads
   * @return Promise
   */
  queue: payloads => queue.push(payloads),

  // app_id: 6722778727758416..,
  app_secret: 'd3163a6893132fd0ccdffa1bb7cfee82..',
  verify_token: 'some-random-string-of-your-choice',
}));
```

Finally, the `worker` operates at the other end of your preferred queue stack, processing messages and sending replies
on behalf of your bot.

```js
const async = require('async');
const comet = require('comet-messenger');
const pages = [ ... ]; // The array of pages from above, for example

const schema = comet.createSchema();
/* Omitted here is all the business logic & methods used to configure the schema */

const worker = comet.createWorker({ pages, schema });
const queue = async.queue((payload, callback) => {
  worker.process(payload).then(() => callback()).catch(err => callback(err));
});
```

## TODO

- Detailed documentation for Schema.
- Unit tests. Although this has been built in a modular-fashion unit-tests are still required!
  Going for :100:% code-coverage too, so watch this space!

## Questions

- [Open an issue](https://github.com/car-throttle/comet-messenger/issues) or feel free to
  [tweet me](https://twitter.com/jdrydn).
