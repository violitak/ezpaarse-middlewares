'use strict';

const useragent = require('useragent');
const agents    = require('./agents.js');

/**
 * Add a new field with a simplified user-agent
 */
module.exports = function () {
  if (this.job.outputFields.added.indexOf('ua') === -1) {
    this.job.outputFields.added.push('ua');
  }

  return function process(ec, next) {
    if (!ec) { return next(); }
    if (!ec['user-agent']) {
      ec.ua = 'none';
      return next();
    }

    ec.ua = useragent.parse(ec['user-agent']).family;

    if (ec.ua === 'Other') {
      const agent = agents.find(a => a.matches.some(m => m.test(ec['user-agent'])));
      if (agent) {
        ec.ua = agent.name;
      }
    }

    next();
  };
};
