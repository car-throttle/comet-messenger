#!/usr/bin/env node
/**
 * Usage: $ node ./node_modules/comet-messenger/bin/update-messenger-profile.js ./bot.js
 * (Where ./bot.js exports an array of pages as "pages")
 */
if (!process.argv.slice(2).length) throw new Error('No bot file given');
// process.env.DEBUG = 'Comet:Facebook-API';
const { pages } = require(require('path').join(process.env.PWD, process.argv.slice(2).shift()));
const facebook = require('../src/lib/facebook-api');

const resolve = Promise.all(pages.filter(({ profile, token }) => profile && token).map(page => {
  return facebook.request({
    access_token: page.token,
    // version: 'v2.6',
    method: 'POST',
    url: '/me/messenger_profile',
    body: page.profile,
  });
}));

resolve.catch(err => console.error(err)).then(() => process.exit(0)); // eslint-disable-line no-console
