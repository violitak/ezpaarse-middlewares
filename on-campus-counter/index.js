'use strict';

const rangeCheck = require('range_check');

// see https://en.wikipedia.org/wiki/Private_network#Private_IPv4_address_spaces
// TODO: hardcoded for now, to be externalized (maybe in the ezpaarse config.json)
let privateRanges = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

try {
  // eslint-disable-next-line global-require
  const privateCustomsRanges = require('../../config.local.json');

  if (privateCustomsRanges.onCampusCounter) {
    privateRanges = privateRanges.concat(privateCustomsRanges.onCampusCounter);
  }
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') {
    this.logger.verbose(e);
  }
}

module.exports = function onCampusCounter() {
  this.logger.verbose('Initializing onCampus counter');
  this.report.set('general', 'on-campus-accesses', 0);

  return function process(ec, next) {
    if (!ec) { return next(); }

    // Usage :
    // console.log(rangeCheck.inRange('192.168.1.1', ['10.0.0.0/8', '192.0.0.0/8']));
    // returns true
    if (rangeCheck.inRange(ec.host, privateRanges)) {
      this.report.inc('general', 'on-campus-accesses');
      ec['on_campus'] = 'Y';
    } else {
      ec['on_campus'] = 'N';
    }

    next();
  };
};
