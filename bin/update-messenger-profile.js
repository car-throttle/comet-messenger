#!/usr/bin/env node
/**
 * Usage: $ node ./node_modules/comet-messenger/bin/update-messenger-profile.js ./bot.js
 * (Where ./bot.js exports an array of pages as "pages")
 */
if (!process.argv.slice(2).length) throw new Error('No bot file given');
const { pages } = require(require('path').join(process.env.PWD, process.argv.slice(2).shift()));

const facebook = require('../src/lib/facebook-api');

const resolve = Promise.resolve();
pages.filter(({ profile, token }) => profile && token).forEach(page => resolve.then(facebook.request({
  access_token: page.token,
  body: page.profile,
  url: '/me/messenger-profile',
  // version: 'v2.6',
})));

resolve.catch(err => console.error(err)).then(() => process.exit(0)); // eslint-disable-line no-console
