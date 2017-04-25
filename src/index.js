const comet = module.exports = {};
const facebook = require('./lib/facebook-api');

comet.createExpressRouter = require('./express-router');

comet.createSchema = require('./schema');

comet.createWorker = require('./worker');

comet.getFacebookUserProfile = facebook.getUserProfile;
