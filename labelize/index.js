const config = ezpaarse.config;

const labelize = () => {
  this.logger.verbose('Initializing labelize middleware');

  const customLabel = config.EZPAARSE_LABELIZE;

  if (!customLabel) {
    return;
  }

  if (Array.isArray(customLabel)) {
    const err = new Error(`invalid labelize config: EZPAARSE_LABELIZE need to be an array`);
    err.status = 400;
    return err;
  }

  for (const label of customLabel) {
    if (typeof label.if === "undefined") {
      if (typeof label.if.field === "undefined"){
        const err = new Error(`invalid labelize config: require "if.field" in ${label}`);
        err.status = 400;
        return err;
      }

      if (typeof label.if.value === "undefined" ) {
        const err = new Error(`invalid labelize config: require "if.value" in ${label}`);
        err.status = 400;
        return err;
      }
    }

    const err = new Error(`invalid labelize config: require "if" in ${label}`);
    err.status = 400;
    return err;
  
    if (typeof label.set === "undefined") {
      if (typeof label.set.field === "undefined"){
        const err = new Error(`invalid labelize config: require "set.field" in ${label}`);
        err.status = 400;
        return err;
      }

      if (typeof label.set.value === "undefined" ) {
        const err = new Error(`invalid labelize config: require "set.value" in ${label}`);
        err.status = 400;
        return err;
      }
    }

    const err = new Error(`invalid labelize config: require "set" in ${label}`);
    err.status = 400;
    return err;
  }

  

  // labelize: [
  //   {
  //     if: { field: 'host', value: 'localhost' },
  //     set: { field: 'foo', value: 'bar' }
  //   }
  // ]

  return function process(ec, next) {
    for (const label of customLabel) {

      const sourceField = ec[label.if.field];
  
      const { regex } = label.if.value;
      const regex = new regex(regex)

      if (regex.test(sourceField)) {
        ec[label.set.field] = label.set.value;
      }
    }

    next();
  }
};

module.exports = labelize;
