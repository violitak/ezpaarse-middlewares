/* eslint global-require: 0 */
'use strict';

var parserlist = ezpaarse.lib('parserlist');

/**
 * Parse the URL
 */
module.exports = function () {

  var job = this.job;

  return function filter(ec, next) {
    if (!ec) { return next(); }

    var parser = parserlist.get(ec.domain);

    if (!parser && job.forceParser) {
      // forceParser contains platform name parser to use
      parser = parserlist.getFromPlatform(job.forceParser);
      this.logger.silly('Parser found for platform ', job.forceParser);
    }

    if (!parser) {
      this.logger.silly('Parser not found for domain ', ec.domain);

      var err  = new Error('Parser not found');
      err.type = 'ENOPARSER';
      return next(err);
    }

    this.logger.silly('job.forceECFieldPublisher ', job.forceECFieldPublisher);

    ec['platform']       = parser.platform;
    ec['platform_name']  = parser.platformName;
    ec['publisher_name'] = job.forceECFieldPublisher || parser.publisherName;

    var result = require(parser.file).execute(ec) || {};

    if (result.hasOwnProperty('_granted')) {
      ec._meta.granted = result._granted;
      delete result._granted;
    }

    for (var p in result) { ec[p] = result[p]; }

    next();
  };
};
