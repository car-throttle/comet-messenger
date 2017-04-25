const template = require('lodash.template');
const templateSettings = require('lodash.templatesettings');
templateSettings.interpolate = /{{([\s\S]+?)}}/g;

module.exports.formatText = function (codes, code, fallback, vars) {
  const compiled = template(`${codes[`${code}`] || fallback}`);
  return compiled(vars || {});
};

module.exports.tryRequire = function (module) {
  try {
    return require(module);
  } catch (err) {
    return null;
  }
};
