'use strict';

const crypto = require('crypto');

/**
 * Anonymize a list of fields
 */
module.exports = function anonymizer() {
  this.logger.verbose('Initializing anonymization');

  const fieldsHeader = this.request.header('Crypted-Fields') || 'host,login';
  const algorithm = this.request.header('Crypting-Algorithm') || 'sha1';
  const salt = this.request.header('Crypting-Salt');

  if (fieldsHeader.toLowerCase() === 'disabled') {
    this.logger.verbose('Crypting disabled');
    return function (ec, next) { next(); };
  }

  const cryptedFields = fieldsHeader.split(',').map(f => f.trim());

  this.logger.verbose(`Crypted fields: ${cryptedFields}`);

  if (salt) {
    return getProcessFunction(cryptedFields, algorithm, salt);
  }

  return new Promise((resolve, reject) => {
    crypto.randomBytes(40, (err, buffer) => {
      if (err) { return reject(err); }
      resolve(getProcessFunction(cryptedFields, algorithm, buffer));
    });
  });
};

function getProcessFunction(fields, algorithm, salt) {
  return function anonymize(ec, next) {
    if (!ec) { return next(); }

    fields.forEach(function (field) {
      if (ec[field]) {
        ec[field] = crypto.createHmac(algorithm, salt).update(ec[field]).digest('hex');
      }
    });

    next();
  };
}