const assert = require('assert');

describe('Comet-Messenger Schema', function () {
  const createSchema = require('../src/schema');

  it('should create a schema object', () => {
    const schema = createSchema();

    assert.equal(typeof schema, 'object');
    assert.equal(typeof schema._getFunction, 'function');
    assert.equal(typeof schema.catchInput, 'function');
    assert.equal(typeof schema.onInput, 'function');
    assert.equal(typeof schema.onPostback, 'function');
    assert.equal(typeof schema.before, 'function');
    assert.equal(typeof schema.after, 'function');
  });
});
