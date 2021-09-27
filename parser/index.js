/* eslint global-require: 0 */
'use strict';

const parserlist = ezpaarse.lib('parserlist');

/**
 * Parse the URL
 */
module.exports = function () {
  const job = this.job;
  const req = this.request;
  const filterString = req.header('filter-platforms');
  const allowWildcards = /^true$/.test(req.header('allow-domain-wildcards'));
  let platformFilter;

  if (filterString) {
    platformFilter = new Set(filterString.split(',').map(platform => platform.trim()));
  }

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

    if (allowWildcards) {
      const subDomains = ec.domain.split('.'); // ['www', 'google', 'fr']
      const domains = [];

      for (let i = 1; i < subDomains.length - 1; i++) {
        domains.push(`*.${subDomains.slice(i).join('.')}`); // *.google.fr
      }

      const parserSet = new Set();

      domains
        .map(domain => parserlist.get(domain))
        .forEach(parserList => {
          if (!parserList) { return; }
          if (!Array.isArray(parserList)) {
            parserList = [parserList];
          }
          parserList.forEach(parser => {
            if (parser && parser.file) {
              parserSet.add(parser);
            }
          });
        });

      parsers = parsers.concat(Array.from(parserSet));
    }

    if (parsers.length === 0 && job.forceParser) {
      const defaultParser = parserlist.getFromPlatform(job.forceParser);
      this.logger.silly(`Looking for the default parser: ${job.forceParser}`);

      if (defaultParser) {
        parsers.push(defaultParser);
      }
    }

    if (parsers.length === 0) {
      this.logger.silly(`No parser found for the domain ${ec.domain}`);

      const err  = new Error('Parser not found');
      err.type = 'ENOPARSER';
      return next(err);
    }

    if (platformFilter) {
      parsers = parsers.filter(parser => platformFilter.has(parser.platform));

      if (parsers.length === 0) {
        // If there are matching parsers that were all filtered out, just ignore this line
        const err = new Error('irrelevant EC');
        err.type = 'EIRRELEVANT';
        return next(err);
      }
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
