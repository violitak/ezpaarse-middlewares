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
    if (!label.if) {
      const err = new Error(`invalid labelize config: require "if" in ${label}`);
      err.status = 400;
      return err;
    }

    if (!label.set) {
      const err = new Error(`invalid labelize config: require "set" in ${label}`);
      err.status = 400;
      return err;
    }

    if (!label.if.field) {
      const err = new Error(`invalid labelize config: require "if.field" in ${label}`);
      err.status = 400;
      return err;
    }

    if (!label.if.value) {
      const err = new Error(`invalid labelize config: require "if.value" in ${label}`);
      err.status = 400;
      return err;
    }

    if (!label.set.field) {
      const err = new Error(`invalid labelize config: require "set.field" in ${label}`);
      err.status = 400;
      return err;
    }

    if (!label.set.value) {
      const err = new Error(`invalid labelize config: require "set.value" in ${label}`);
      err.status = 400;
      return err;
    }
  }


  return function process(ec, next) {
    if (!ec) {
      return next();
    }

    for (const label of customLabel) {
      const sourceField = ec[label.if.field];

      const pattern = new RegExp(label.if.value, 'i')

      if (pattern.test(sourceField)) {

        ec[label.set.field] = label.set.value;
      }
    }

    next();
  }
};

module.exports = labelize;
