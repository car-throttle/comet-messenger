const crypto = require('crypto');
const utils = require('./lib/utils');
const xhub = require('express-x-hub');

const bodyParser = utils.tryRequire('body-parser');
const express = utils.tryRequire('express');

module.exports = function createExpressRouter({ pages, queue, app_secret, verify_token, logger }) {
  if (!express) throw new Error('Module "express" not found - did you forget to install it?');

  /**
   * Sad fatals for missing config
   */
  if (!Array.isArray(pages)) throw new Error('Missing array of Facebook pages for expressRouter');
  if (!verify_token) throw new Error('Missing verify_token for expressRouter');
  if (!queue) throw new Error('Missing queue for expressRouter');

  /**
   * If there's no app_secret, throw a warning because whilst we can accept requests we can't authenticate them.
   */
  if (!app_secret) {
    console.warn('A comet router was created, but no app_secret was passed to the config'); // eslint-disable-line no-console
    console.warn('Facebook Messenger Verification will be skipped, technically allowing anyone to trigger messages'); // eslint-disable-line no-console
    console.warn('Add your app\'s secret to comet.createServer to suppress this message'); // eslint-disable-line no-console
    console.warn('To ignore this & continue, install body-parser (required to parse the JSON-body)'); // eslint-disable-line no-console
    if (!bodyParser) throw new Error('Module "body-parser" not found');
  }

  const router = express.Router();

  const log_error = logger && logger.error ? (...args) => logger.error(...args) : (...args) => console.error(...args); // eslint-disable-line no-console
  const log_warn = logger && logger.warn ? (...args) => logger.warn(...args) : (...args) => console.warn(...args); // eslint-disable-line no-console

  const page_ids = pages.filter(({ id }) => Boolean(id)).map(({ id }) => `${id}`);
  const status = pages.map(({ id, name }) => `${name || id} - ${crypto.randomBytes(16).toString('hex')}`).join('\n');

  /**
   * Configure the GET request, so Facebook can verify this API.
   */
  router.get('/', (req, res) => {
    res.status(200).set('Content-Type', 'text/plain');
    if (req.query['hub.verify_token'] === verify_token) res.send(req.query['hub.challenge']);
    else res.send(status);
  });

  /**
   * Configure a Status route, for autoscaling etc.
   */
  router.get('/status', (req, res) => res.status(200).set('Content-Type', 'text/plain').send(status));

  /**
   * Configure the POST request, so Facebook can send messages to this API.
   * All this does is flatten the messages into a single array, and append them to the queue.
   */
  router.post('/', [
    app_secret ? xhub({ algorithm: 'sha1', secret: app_secret }) : bodyParser.json({ limit: '1mb' }),
    (req, res) => {
      res.status(200).set('Content-Type', 'text/plain');

      if (app_secret && (!typeof req.isXHubValid !== 'function' || !req.isXHubValid())) {
        return res.send('These violent delights have violent ends');
      }

      const payloads = [];

      // For each page
      if (Array.isArray(req.body.entry)) req.body.entry.forEach(entry => {
        // If the page ID is missing from this request, or it's not for this platform, drop it
        if (!entry || !entry.id || page_ids.indexOf(`${entry.id}`) < 0) return;
        // For each message
        if (Array.isArray(entry.messaging)) entry.messaging.forEach(ev => { // eslint-disable-line max-statements
          const payload = { page_id: `${entry.id}`, user_id: `${ev.sender.id}` };

          if (ev.postback && ev.postback.payload) {
            payload.type = 'postback';
            // Queue message with the postback
            try { payload.postback = JSON.parse(ev.postback.payload); }
            catch (err) { payload.postback = null; }
            if (!payload.postback) return;
          }
          else if (ev.message) {
            if (ev.message.is_echo) {
              // If this is an echo with an app_id, then it's a message that the bot has sent
              // Otherwise, a human is talking to the recipient, so we need to silence the bot for a period of time
              if (!ev.message.app_id) {
                payload.type = 'silence';
              }
            } else {
              if (Array.isArray(ev.message.attachments) && ev.message.attachments.length) {
                payload.type = 'input';
                payload.attachments = ev.message.attachments.map(function (attachment) {
                  return Object.assign({ type: attachment.type }, attachment.payload || {});
                });
              }
              else if (ev.message.text) {
                payload.type = 'input';
                payload.text = ev.message.text.trim();

                if (ev.message.quick_reply && ev.message.quick_reply.payload) {
                  try { payload.quick_reply = JSON.parse(ev.message.quick_reply.payload); } // eslint-disable-line max-depth
                  catch (err) { payload.quick_reply = null; }
                }
              }
            }
          }

          if (payload.type) payloads.push(payload);
        });
      });

      if (payloads.length) queue(payloads).catch(err => log_error(err));
      else log_warn(`No payloads to queue for body: ${JSON.stringify(req.body)}`);

      return res.send('Thank you 😎');
    }
  ]);

  router.use((req, res) => res.status(200).set('Content-Type', 'text/plain').send('Not found'));
  return router;
};
