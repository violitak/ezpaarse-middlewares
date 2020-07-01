'use strict';

/**
 * Populate specific fields with arbitrary data
 */
module.exports = function () {
  const header = this.request.header('populate-fields');
  let fields;

  if (!header) { return (ec, next) => next(); }

  try {
    fields = JSON.parse(header);
  } catch (e) {
    const err = new Error(`Invalid JSON syntax: ${e.message}`);
    err.status = 400;
    return err;
  }

  if (typeof fields !== 'object' || Array.isArray(fields)) {
    const err = new Error('Header Populate-Fields should be a JSON object');
    err.status = 400;
    return err;
  }

  fields = Object.entries(fields);

  fields.forEach(([name, value]) => {
    this.logger.verbose(`Creating field "${name}" with value "${value}"`);
    if (this.job.outputFields.added.indexOf(name) === -1) {
      this.job.outputFields.added.push(name);
    }
  });

  return function process(ec, next) {
    if (!ec) { return next(); }

    fields.forEach(([name, value]) => {
      ec[name] = value;
    });

    next();
  };
};
