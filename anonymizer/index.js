'use strict';

var crypto = require('crypto');

/**
 * Anonymize a list of fields
 */
module.exports = function anonymizer() {
  this.logger.verbose('Initializing anonymization');

  var header = this.request.header('Crypted-Fields') || 'host,login';

  if (header.toLowerCase() === 'disabled') {
    this.logger.verbose('Crypting disabled');
    return function (ec, next) { next(); };
  }

  var cryptedFields = header.split(',').map(f => f.trim());

  this.logger.verbose('Crypted fields: ' + cryptedFields);

  return new Promise(function (resolve, reject) {
    crypto.randomBytes(40, function (err, buffer) {
      if (err) { return reject(err); }

      resolve(function anonymize(ec, next) {
        if (!ec) { return next(); }

        cryptedFields.forEach(function (field) {
          if (ec[field]) {
            ec[field] = crypto.createHmac('sha1', buffer).update(ec[field]).digest('hex');
          }
        });

        next();
      });
    });
  });

};
