const config = ezpaarse.config;

const labelize = function () {
  this.logger.verbose('Initializing labelize middleware');

  const customLabel = config.EZPAARSE_LABELIZE;

  if (!customLabel) {
    return;
  }

  if (!Array.isArray(customLabel)) {
    const err = new Error(`invalid labelize config: EZPAARSE_LABELIZE need to be an array`);
    err.status = 400;
    return err;
  }

  for (const label of customLabel) {
    if (!label.from) {
      const err = new Error(`invalid labelize config: require "from" in ${label}`);
      err.status = 400;
      return err;
    }

    if (!label['result-field']) {
      const err = new Error(`invalid labelize config: require "result-field" in ${label}`);
      err.status = 400;
      return err;
    }

    if (!label.mapping) {
      const err = new Error(`invalid labelize config: require "mapping" in ${label}`);
      err.status = 400;
      return err;
    }
  }

  return function process(ec, next) {
    if (!ec) {
      return next();
    }

    for (const label of customLabel) {
      const { from, mapping } = label;
      const field = label['result-field'];
    
      const sourceField = ec[from];

      if (!sourceField) {
        const err = new Error(`field [${from}] not found`);
        return next(err);
      }

      if (ec[field]) return;

      ec[field] = mapping[ec[from]] ? mapping[ec[from]] : '';
    }

    next();
  }
};

module.exports = labelize;
