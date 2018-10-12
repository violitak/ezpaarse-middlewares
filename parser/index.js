/* eslint global-require: 0 */
'use strict';

const parserlist = ezpaarse.lib('parserlist');

/**
 * Parse the URL
 */
module.exports = function () {

  const job = this.job;

  if (job.forceECFieldPublisher) {
    this.logger.verbose(`Forced publisher name : ${job.forceECFieldPublisher}`);
  }

  return function filter(ec, next) {
    if (!ec) { return next(); }

    let parsers = parserlist.get(ec.domain);

    if (!parsers) {
      parsers = [];
    } else if (!Array.isArray(parsers)) {
      parsers = [parsers];
    }

    if (parsers.length === 0 && job.forceParser) {
      // forceParser contains platform name parser to use
      parsers.push(parserlist.getFromPlatform(job.forceParser));
      this.logger.silly(`Parser found for platform ${job.forceParser}`);
    }

    if (parsers.length === 0) {
      this.logger.silly(`Parser not found for domain ${ec.domain}`);

      const err  = new Error('Parser not found');
      err.type = 'ENOPARSER';
      return next(err);
    }

    for (const parser of parsers) {
      const result = require(parser.file).execute(ec);

      if (result && Object.keys(result).length > 0) {
        ec['platform']       = parser.platform;
        ec['platform_name']  = parser.platformName;
        ec['publisher_name'] = job.forceECFieldPublisher || parser.publisherName;

        if (result.hasOwnProperty('_granted')) {
          ec._meta.granted = result._granted;
          delete result._granted;
        }

        for (const p in result) {
          ec[p] = result[p];
        }

        return next();
      }
    }

    const err = new Error('EC not qualified');
    err.type = 'ENOTQUALIFIED';
    next(err);
  };
};
