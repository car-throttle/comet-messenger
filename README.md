# comet-messenger

[![NPM](https://badge.fury.io/js/comet-messenger.svg)](https://www.npmjs.com/package/comet-messenger)
![Circle CI](https://circleci.com/gh/car-throttle/comet-messenger/tree/master.svg?style=shield)
![Coverage Status](https://coveralls.io/repos/car-throttle/comet-messenger/badge.svg?branch=master&service=github)

Node-JS microservice-oriented framework for interacting with
[Facebook Messenger](https://developers.facebook.com/products/messenger/) :sunglasses:

----

Some **important factors** to bear in mind:

- Comet makes absolutely no assumptions about your architecture, but does assume the API service will be attached to an
  Express application (happy to accept PRs for more web frameworks).
- It does provide some structure for building your own messenger bots.
- `async/await` functions are used in the core, and are encouraged.
- Follows the hop naming convention: [:beers:](https://en.wikipedia.org/wiki/List_of_hop_varieties#Comet).

## Installation

```
$ npm install comet-messenger
```

If preferred you can clone directly from the GitHub repository. `master` is guaranteed to be stable, but there's no
guarantee of changes between major versions breaking existing code. [Semver](https://github.com/npm/node-semver) up, yo!

## Usage

In Comet, the concept of a bot is split into `pages`, `schema`, `router` and `worker`.

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
your Messenger bot. All your business logic is going to end up in here! See the [Schema API](#Schema-API) section for
more information on the methods here and other methods you can use.

```js
const comet = require('comet-messenger');
const schema = comet.createSchema();

/**
 * In Messenger, a postback occurs when a user clicks a button.
 */
schema.onPostback('GETTING_STARTED', function ({ payload, send }) {
  return send([
    `Hey there!`,
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
   * A function which accepts a Promise in return, so you can push messages onto your preferred queue
   * stack. Since this function is wrapped around an await call, it doesn't matter if this function is
   * asynchronous or not.
   *
   * @param Array payloads
   * @return Promise
   */
  queue: payloads => queue.push(payloads),

  // app_id: 6722778727758416..,
  app_secret: 'd3163a6893132fd0ccdffa1bb7cfee82..',
  verify_token: 'some-random-string-of-your-choice',

  // logger: { ... } Any instance/object that has info, warn & error methods
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

## Schema API

The schema holds all the business logic of your bot, and has several methods to help you map out your conversation as
you see fit.

The Messenger platform sends hooks to your API for you to consume (and hopefully pass to Comet!). But their main form
of communication is a little.. _fractured_. They send messages and they send `postback`s, which are supposed to
be when a user presses a button, but they don't specify how this should be properly used (and if a user scrolls back
through the conversation they can re-fire a postback, which plays havoc with any sort of state management!).

So, in order to continue this separation of concerns, Comet lets you setup functions for raw input and postbacks.

### schema.onPostback(pointer, function)

This sets a function for a particular postback type, and will execute that function when this postback is received.

**Important note:** Comet does a little pre-processing on these postbacks, most importantly taking a string and
transforming it into `{ type: "%s" }`. Why? This immediately allows for complex postback functions, with types and
parameters, as long as you remember to JSON-encode any postback payloads (as seen above in the `messenger_buttons`
array).

```js
schema.onPostback('GETTING_STARTED', function ({ payload, send }) {
  return send([
    `Hey there!`,
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
```

### schema.catchInput(function)

This sets a function that will execute whenever free-flowing text is received. This includes attachments.

```js
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
```

### schema.before(function)

This queues a function to run before the main input/postback function, allowing data to be fetched before all business
logic. Use this to fetch [the user's profile from Facebook](#) or load state or record analytics.

```js
schema.before(async function (req) {
  const { page, payload } = req;

  req.user = await getUserFromFacebookAndCache({ user_id: payload.user_id });
  req.state = await getStateForUser({ page: page.id, user_id: payload.user_id });
  req.pointer = req.state.getPointer(); // This could return a string, like 'SENDING_FAV_COLOR'
});
```

### schema.after(function)

This queues a function to run after the main input/postback function. Be creative :sunglasses:

```js
schema.before(async function (req) {
  const { page, payload, state } = req;
  if (state.hasModified()) await saveStateForUser({ page: page.id, state, user_id: payload.user_id })
});
```

### schema.onInput(pointer, callback)

Suddenly, if the concept of state is introduced we don't need one function to handle all free-flowing text that a user
sends to a bot. Which could be a lot, they're inside a messaging app, it's sort of a given? In any case, setting
`req.pointer` [in a before function](#schemabeforefunction) will mean Comet will look for a input function referring
to a particular state, **exactly like a postback function**, which means we can handle all kinds of input from the user
with little difficulty:

```js
schema.onInput('SENDING_FAV_COLOR', function ({ payload, send }) {
  // If the user triggers this function, it means we KNOW we've marked them as SENDING_FAV_COLOR, so we
  // know what we're expecting. Hooray!
  const colour = (payload.text || '').trim();
  if (colour.indexOf('#') === 0) return send('Ooh, a hex code? You\'re not a developer, are you?');
  else return send(`Cool, ${colour} is my favourite colour too!`);
});

schema.onInput('SENDING_NEW_PROFILE_PIC', function ({ payload, send }) {
  const attachment = Array.isArray(payload.attachments) ? payload.attachments.shift() : null;
  if (!attachment || !attachment.type) return send('Erm, you need to attach some content');
  else return send(`Thanks for sending that ${attachment.type} through!`);
});
```

## TODO

- More documentation
- Unit tests. Although this has been built in a modular-fashion unit-tests are still required!
  Going for :100:% code-coverage too, so watch this space!

## Questions

- [Open an issue](https://github.com/car-throttle/comet-messenger/issues) or feel free to
  [tweet me](https://twitter.com/jdrydn).
