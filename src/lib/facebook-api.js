// const debug = require('debug')('Comet:Facebook-API');
const facebook = module.exports = {};
const https = require('https');
const querystring = require('querystring');

const DEFAULT_VERSION = 'v2.6';

facebook.request = function ({ method, url, headers, body, access_token, fields, version }) {
  const query = { access_token };
  if (fields) query.fields = fields;

  const opts = {
    hostname: 'graph.facebook.com',
    method: method || 'GET',
    headers: Object.assign({}, headers),
    path: `/${version || DEFAULT_VERSION}${url}?${querystring.stringify(query)}`,
  };

  if (body) {
    body = JSON.stringify(body);
    opts.headers['Content-Length'] = body.length;
    opts.headers['Content-Type'] = 'application/json';
  }

  // debug('req', opts, body || '');

  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      const results = {
        status: res.statusCode,
        headers: res.headers,
        body: '',
      };

      res.setEncoding('utf8');
      res.on('data', chunk => results.body += `${chunk}`);
      res.on('end', () => {
        try { results.body = JSON.parse(results.body); }
        catch (err) { return reject(err); }

        // debug('res', results);
        return resolve(results);
      });
    });

    req.on('error', err => reject(err));
    if (body) req.write(body);
    req.end();
  });
};

facebook.getUserProfile = function ({ access_token, user_id, version }) {
  return facebook.request({ access_token, version, url: `/${user_id}` }).then(({ body }) => {
    if (body && body.first_name && body.last_name) return Object.assign({ id: user_id }, body);
    else throw new Error(`User not found for #${user_id}`);
  });
};

facebook.send = function ({ access_token, message, user_id, version }) {
  const body = { recipient: { id: user_id }, message };
  return facebook.request({ access_token, version, method: 'POST', url: '/me/messages', body })
    .then(({ status }) => {
      if (status !== 200) throw new Error(`Invalid response: ${status}`);
    });
};
