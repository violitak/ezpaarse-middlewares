'use strict';

const cache = ezpaarse.lib('cache')('sudoc');
const sudoc = require('sudoc');

const issnPattern = /^[0-9]{4}-[0-9xX]{4}$/i;
const isbnPattern = /^(97(8|9))?\d{9}(\d|X)$/i;

/**
 * Enrich ECs with HAL data
 */
module.exports = function () {
  const activated = (this.request.header('sudoc-enrich') || '').toLowerCase() === 'true';
  let throttle = parseInt(this.request.header('sudoc-throttle'));
  let ttl = parseInt(this.request.header('sudoc-ttl'));
  let maxAttempts = parseInt(this.request.header('sudoc-max-attempts'));

  if (isNaN(throttle)) { throttle = 500; }
  if (isNaN(ttl)) { ttl = 3600 * 24 * 7; }
  if (isNaN(maxAttempts)) { maxAttempts = 5; }

  if (!activated) {
    this.logger.verbose('Sudoc enrichment not activated');
    return function (ec, next) { next(); };
  }

  const self = this;
  const report = this.report;
  const pending = new Map();
  const buffer = [];
  let busy = false;

  self.logger.verbose('Sudoc enrichment activated');
  self.logger.verbose('Sudoc throttle: %dms', throttle);

  report.set('general', 'sudoc-queries', 0);
  report.set('general', 'sudoc-fails', 0);
  report.inc('general', 'sudoc-not-found', 0);
  report.set('general', 'sudoc-enriched-ecs', 0);

  if (!cache) {
    const err = new Error('failed to connect to mongodb, cache not available for sudoc');
    err.status = 500;
    return err;
  }

  /**
   * Pull the next EC to enrich with sudoc
   */
  function pullBuffer() {
    const ec = buffer.shift();
    if (!ec) {
      busy = false;
      return self.drain();
    }

    let sudoc2method; // service used for sudoc request

    if (issnPattern.test(ec.print_identifier)) {
      self.logger.silly('Sudoc : print_identifier is issn ', ec);
      sudoc2method = 'issn2ppn';
    } else if (isbnPattern.test(ec.print_identifier)) {
      self.logger.silly('Sudoc : print_identifier is isbn ', ec);
      sudoc2method = 'isbn2ppn';
    } else {
      self.logger.silly('Sudoc : print_identifier %s not matching ', ec.print_identifier);
      release(ec.print_identifier, null);
      return pullBuffer();
    }

    let tries = 0;

    (function querySudoc() {
      if (++tries > maxAttempts) {
        const err = new Error(`Failed to query Sudoc ${maxAttempts} times in a row`);
        return self.job._stop(err);
      }

      report.inc('general', 'sudoc-queries');

      sudoc[sudoc2method](ec.print_identifier, function (err, doc) {
        if (err) {
          if (err) {
            report.inc('general', 'sudoc-fails');
            self.logger.error('Sudoc: ', err.message);
            return setTimeout(querySudoc, throttle);
          }
          release(ec.print_identifier, null);
          return setTimeout(pullBuffer, throttle);
        }

        if (!doc) { report.inc('general', 'sudoc-not-found'); }

        cache.set(ec.print_identifier.toString(), doc || {}, function (err) {
          if (err) {
            report.inc('general', 'sudoc-fails');
          }

          release(ec.print_identifier, doc || null);
          setTimeout(pullBuffer, throttle);
        });
      });
    })();
  }

  /**
   * Release every ECs with a given print_identifier
   * @param  {String} printIdentifier
   * @param  {Object} data     SUDOC data to enrich ECs, if any
   */
  function release(printIdentifier, data) {
    const result = data && data.query && (data.query.result || data.query.resultNoHolding);

    pending.get(printIdentifier).forEach(function (ec) {
      self.logger.silly('Sudoc : request ', data);

      const ppn = result && result.ppn;

      if (ppn) {
        ec[0]['sudoc-ppn'] = ppn;
        report.inc('general', 'sudoc-enriched-ecs');
        self.logger.silly('Sudoc : find ', data.query);
      } else {
        self.logger.verbose('Sudoc : unknown result %s structure for %s ', data, printIdentifier);
      }

      ec[1]();
    });

    pending.delete(printIdentifier);
  }

  function enrich(ec, next) {
    if (!activated || !ec || !ec.print_identifier) {
      return next();
    }

    self.logger.silly('Sudoc : enrichment');

    // If an EC with the same print_identifier is being processed, add this one to pending
    if (pending.has(ec.print_identifier)) {
      return pending.get(ec.print_identifier).push([ec, next]);
    }

    pending.set(ec.print_identifier, [[ec, next]]);

    cache.get(ec.print_identifier.toString(), function (err, cachedDoc) {
      if (err) { return next(); }

      if (cachedDoc) {
        return release(ec.print_identifier, cachedDoc || null);
      }

      buffer.push(ec);
      if (busy) { return; }

      busy = true;
      self.saturate();

      pullBuffer();
    });
  }

  return new Promise(function (resolve, reject) {
    if (!activated) { return resolve(enrich); }

    cache.checkIndexes(ttl, function (err) {
      if (err) {
        self.logger.error('SUDOC: failed to ensure indexes');
        return reject(new Error('failed to ensure indexes for the cache of SUDOC'));
      }

      resolve(enrich);
    });
  });
};
