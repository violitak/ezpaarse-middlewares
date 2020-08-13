'use strict';

const rangeCheck = require('range_check');
const config = ezpaarse.config;

// see https://en.wikipedia.org/wiki/Private_network#Private_IPv4_address_spaces
const privateRanges = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

module.exports = function onCampusCounter() {
  this.logger.verbose('Initializing on-campus-counter');
  const report = this.report;
  report.set('general', 'on-campus-accesses', 0);
  report.set('general', 'off-campus-accesses', 0);

  let localRanges = privateRanges.slice(); // Contains ranges without label
  let allRanges = [{ ranges: localRanges }];

  const customRanges = Array.isArray(config.onCampusCounter) ? config.onCampusCounter : [];

  for (const range of customRanges) {
    if (typeof range === 'string') {
      if (!rangeCheck.isRange(range)) {
        const err = new Error(`invalid IP range: ${range}`);
        err.status = 400;
        return err;
      }

      localRanges.push(range);
    }

    if (typeof range === 'object') {
      if (!range.label || !Array.isArray(range.ranges)) {
        const err = new Error('invalid custom range: no label or ranges is not an array');
        err.status = 400;
        return err;
      }

      const invalidRange = range.ranges.find(r => !rangeCheck.isRange(r));

      if (invalidRange) {
        const err = new Error(`invalid IP range: ${invalidRange}`);
        err.status = 400;
        return err;
      }

      allRanges.push(range);
    }
  }

  return function process(ec, next) {
    if (!ec) { return next(); }

    // Usage : rangeCheck.inRange('192.168.1.1', ['10.0.0.0/8', '192.0.0.0/8']);
    const campus = allRanges.find(campus => rangeCheck.inRange(ec.host, campus.ranges));

    if (campus) {
      report.inc('general', 'on-campus-accesses');
      ec['on_campus'] = campus.label || 'Y';
    } else {
      report.inc('general', 'off-campus-accesses');
      ec['on_campus'] = 'N';
    }

    next();
  };
};
