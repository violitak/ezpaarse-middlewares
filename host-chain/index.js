'use strict';

/**
 * Split the host and keep the real one
 */
module.exports = function () {
  const req = this.request;

  const last = /^last$/i.test(req.header('Host-Chain-Real-Position'));
  const separator = req.header('Host-Chain-Separator') || ',';
  const hostField = req.header('Host-Chain-Field') || 'host';
  const fullField = req.header('Host-Chain-Full-Field') || 'full_host';

  return function process(ec, next) {
    if (!ec) { return next(); }
    if (typeof ec[hostField] !== 'string') { return next(); }

    const hosts = ec[hostField].split(separator);
    ec[fullField] = ec[hostField];
    ec[hostField] = hosts[last ? hosts.length - 1 : 0].trim();
    next();
  };
};
