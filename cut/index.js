'use strict';

/**
 * Extract data from a field
 */
module.exports = function () {
  const header = this.request.header('extract');

  if (!header) { return (ec, next) => next(); }

  // field=>regex=>a,b,c
  // host: 127.0.0.1/16=>([0-9]+)\/([0-9]+)=>host,aze
  // host: 127.0.0.1/16=>split(\/)=>host,aze
  const params = /^(.+?)=>(.+?)=>(.+?)$/.exec(header);

  if (!params) {
    const err = new Error('Invalid extract expression');
    err.status = 400;
    return err;
  }

  const sourceField = params[1].trim();
  const destFields  = params[3].split(',').map(s => s.trim());
  const expression  = toRegex(params[2].trim());

  this.logger.verbose('Extracting %s into %s', sourceField, destFields);

  destFields.forEach(field => {
    if (this.job.outputFields.added.indexOf(field) === -1) {
      this.job.outputFields.added.push(field);
    }
  });

  let match;

  if (expression instanceof RegExp) {
    this.logger.verbose('Extracting by applying a RegExp: %s', expression);

    this.extract = function (source) {
      match = expression.exec(source);
      return (match && match.slice(1)) || [];
    };

  } else if ((match = /^split\((.+)\)$/.exec(expression))) {
    const splitExp = toRegex(match[1]);
    this.logger.verbose('Extracting by splitting with: %s', splitExp);

    this.extract = function (source) {
      return source.split(splitExp);
    };

  } else {
    const err = new Error('Invalid extract expression');
    err.status = 400;
    return err;
  }

  return function process(ec, next) {
    if (!ec || !ec[sourceField]) { return next(); }

    const extractedValues = this.extract(ec[sourceField]);

    extractedValues.forEach((value, index) => {
      if (destFields[index]) {
        ec[destFields[index]] = value;
      }
    });

    next();
  };
};

/**
 * Cast str to RegExp if looking like a literal regex
 * Otherwise return str
 */
function toRegex(str) {
  const regParams = /^\/(.+)\/([gimy]*)$/.exec(str);
  return regParams ? new RegExp(regParams[1], regParams[2]) : str;
}
