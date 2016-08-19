'use strict';

var ecFilter = ezpaarse.lib('ecfilter');

/**
 * Check EC qualification
 */
module.exports = function qualifier() {

  return function qualify(ec, next) {
    if (!ec || ecFilter.isQualified(ec)) { return next(); }

    var err  = new Error('EC not qualified');
    err.type = 'ENOTQUALIFIED';
    next(err);
  };
};
