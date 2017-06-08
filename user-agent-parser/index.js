'use strict';

const useragent = require('useragent');
const agents    = require('./agents.js');

/**
 * Add a new field with a simplified user-agent
 */
module.exports = function () {
  return function process(ec, next) {
    if (!ec || !ec['user-agent']) { return next(); }

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
