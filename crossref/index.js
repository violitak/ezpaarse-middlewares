'use strict';

const co         = require('co');
const request    = require('request');
const cache      = ezpaarse.lib('cache')('crossref');
const doiPattern = /^10\.[0-9]{4,}\/[a-z0-9\-._: ;()/]+$/i;

/**
 * Enrich ECs with crossref data
 */
module.exports = function () {
  const self   = this;
  const req    = this.request;
  const report = this.report;

  const disabled       = /^false$/i.test(req.header('crossref-enrich'));
  const cacheEnabled   = !/^false$/i.test(req.header('crossref-cache'));
  const includeLicense = /^true$/i.test(req.header('crossref-license'));

  if (disabled) {
    self.logger.verbose('Crossref enrichment not activated');
    return function (ec, next) { next(); };
  }

  let apiToken = req.header('crossref-plus-api-token');
  let userAgent = req.header('crossref-user-agent');

  if (!userAgent) {
    userAgent = 'ezPAARSE (https://ezpaarse.org; mailto:ezteam@couperin.org)';
  }

  const queryHeaders = {
    'user-agent': userAgent
  };

  if (apiToken) {
    if (!/^bearer /i.test(apiToken)) {
      apiToken = `Bearer ${apiToken}`;
    }
    queryHeaders['crossref-plus-api-token'] = apiToken;
  }


  self.logger.verbose('Crossref cache: %s', cacheEnabled ? 'enabled' : 'disabled');

  // Strategy to adopt when an enrichment reaches maxTries : abort, ignore, retry
  let onFail = (req.header('crossref-on-fail') || 'abort').toLowerCase();
  let onFailValues = ['abort', 'ignore', 'retry'];

  if (onFail && !onFailValues.includes(onFail)) {
    const err = new Error(`Crossref-On-Fail should be one of: ${onFailValues.join(', ')}`);
    err.status = 400;
    return err;
  }

  if (this.job.outputFields.added.indexOf('title') === -1) {
    this.job.outputFields.added.push('title');
  }
  if (this.job.outputFields.added.indexOf('type') === -1) {
    this.job.outputFields.added.push('type');
  }
  if (this.job.outputFields.added.indexOf('subject') === -1) {
    this.job.outputFields.added.push('subject');
  }
  if (includeLicense && this.job.outputFields.added.indexOf('license') === -1) {
    this.job.outputFields.added.push('license');
  }

  const ttl        = parseInt(req.header('crossref-ttl')) || 3600 * 24 * 7;
  let throttle     = parseInt(req.header('crossref-throttle')) || 200;
  // Maximum number of DOIs to query in a single request
  const packetSize = parseInt(req.header('crossref-paquet-size')) || 50;
  // Minimum number of ECs to keep before resolving them
  let bufferSize   = parseInt(req.header('crossref-buffer-size'));
  // Maximum enrichment attempts
  let maxTries     = parseInt(req.header('crossref-max-tries'));
  // Base wait time after a request fails
  let baseWaitTime = parseInt(req.header('crossref-base-wait-time'));

  if (isNaN(bufferSize)) { bufferSize = 1000; }
  if (isNaN(maxTries)) { maxTries = 5; }
  if (isNaN(baseWaitTime)) { baseWaitTime = 1000; }

  const buffer = [];
  let busy = false;
  let finalCallback = null;

  self.logger.verbose('Crossref enrichment activated');
  self.logger.verbose('Crossref throttle: %dms', throttle);
  self.logger.verbose('Crossref paquet size: %d', packetSize);
  self.logger.verbose('Crossref buffer size: %d', bufferSize);

  report.set('general', 'crossref-queries', 0);
  report.set('general', 'crossref-fails', 0);
  report.set('general', 'crossref-invalid-dois', 0);

  let minResponseTime = -1;
  let maxResponseTime = -1;
  report.set('general', 'crossref-min-response-time', minResponseTime);
  report.set('general', 'crossref-max-response-time', maxResponseTime);

  return new Promise(function (resolve, reject) {
    cache.checkIndexes(ttl, function (err) {
      if (err) {
        self.logger.error('Crossref: failed to ensure indexes');
        return reject(new Error('failed to ensure indexes for the cache of Crossref'));
      }

      resolve(process);
    });
  });

  function process(ec, next) {
    if (!ec) {
      finalCallback = next;
      if (!busy) {
        drainBuffer().then(() => {
          finalCallback();
        }).catch(err => {
          this.job._stop(err);
        });
      }
      return;
    }

    buffer.push([ec, next]);

    if (buffer.length > bufferSize && !busy) {
      busy = true;
      self.saturate();

      drainBuffer().then(() => {
        busy = false;
        self.drain();

        if (finalCallback) { finalCallback(); }
      }).catch(err => {
        this.job._stop(err);
      });
    }
  }

  /**
   * Iterate over the buffer, remove ECs with no DOI/PII or cached DOI/PII
   * return a packet of ecs with an uncached DOI
   */
  function getPacket() {
    const packet = {
      'ecs': [],
      'doi': new Set(),
      'alternative-id': new Set()
    };

    return co(function* () {

      while (packet.doi.size < packetSize && packet['alternative-id'].size < packetSize) {
        const [ec, done] = buffer.shift() || [];
        if (!ec) { return packet; }

        if (!ec.pii && !ec.doi) {
          done();
          continue;
        }

        if (ec.doi && !doiPattern.test(ec.doi)) {
          report.inc('general', 'crossref-invalid-dois');
          done();
          continue;
        }

        if (ec.pii && cacheEnabled) {
          const cachedDoc = yield checkCache(ec.pii);

          if (cachedDoc) {
            aggregate(cachedDoc, ec);
            done();
            continue;
          }
        }

        if (ec.doi && cacheEnabled) {
          const cachedDoc = yield checkCache(ec.doi);

          if (cachedDoc) {
            aggregate(cachedDoc, ec);
            done();
            continue;
          }
        }

        packet.ecs.push([ec, done]);
        if (ec.doi) { packet.doi.add(ec.doi); }
        if (ec.pii) { packet['alternative-id'].add(ec.pii); }
      }

      return packet;
    });
  }

  function checkCache(identifier) {
    return new Promise((resolve, reject) => {
      if (!identifier) { return resolve(); }

      cache.get(identifier.toLowerCase(), (err, cachedDoc) => {
        if (err) { return reject(err); }
        resolve(cachedDoc);
      });
    });
  }

  function drainBuffer() {
    return co(function* () {

      while (buffer.length >= bufferSize || (finalCallback && buffer.length > 0)) {

        const packet = yield getPacket();

        if (packet.ecs.length === 0 || (packet.doi.size + packet['alternative-id'].size === 0)) {
          self.logger.silly('Crossref: no doi or pii in the paquet');
          yield new Promise(resolve => { setImmediate(resolve); });
          continue;
        }

        const results = new Map();

        for (const identifier of ['doi', 'alternative-id']) {
          if (packet[identifier].size === 0) { continue; }
          let tries = 0;
          let list;

          while (!list) {
            if (tries >= maxTries) {
              if (onFail === 'ignore') {
                self.logger.error(
                  `Crossref: ignoring packet enrichment after ${maxTries} failed attempts`
                );
                packet.ecs.forEach(([, done]) => done());
                return;
              }

              if (onFail === 'abort') {
                const err = new Error(`Failed to query Crossref ${maxTries} times in a row`);
                return Promise.reject(err);
              }
            }

            yield wait(tries === 0 ? throttle : baseWaitTime * Math.pow(2, tries));

            try {
              list = yield queryCrossref(identifier, Array.from(packet[identifier]));
            } catch (e) {
              report.inc('general', 'crossref-fails');
              self.logger.error(`Crossref: ${e.message}`);
            }

            tries += 1;
          }

          for (const item of list) {
            let { 'DOI': doi, 'alternative-id': pii } = item;

            if (doi) {
              doi = doi.toLowerCase();
              results.set(doi, item);

              try {
                yield cacheResult(doi, item);
              } catch (e) {
                report.inc('general', 'crossref-cache-fail');
              }
            }

            if (pii && pii[0]) {
              pii = pii[0].toLowerCase();
              results.set(pii, item);

              try {
                yield cacheResult(pii, item);
              } catch (e) {
                report.inc('general', 'crossref-cache-fail');
              }
            }
          }
        }

        for (const [ec, done] of packet.ecs) {
          if (ec.pii) {
            const pii = ec.pii.toLowerCase();

            if (results.has(pii)) {
              aggregate(results.get(pii), ec);
            } else {
              try {
                yield cacheResult(pii, {});
              } catch (e) {
                report.inc('general', 'crossref-cache-fail');
              }
            }
          }

          if (ec.doi) {
            const doi = ec.doi.toLowerCase();

            if (results.has(doi)) {
              aggregate(results.get(doi), ec);
            } else {
              try {
                yield cacheResult(doi, {});
              } catch (e) {
                report.inc('general', 'crossref-cache-fail');
              }
            }
          }

          done();
        }
      }
    });
  }

  function wait(ms) {
    return new Promise(resolve => { setTimeout(resolve, ms); });
  }

  function handleCrossrefRateLimit(response) {
    const headers = (response && response.headers) || {};
    const limitHeader = headers['x-rate-limit-limit'];
    const intervalHeader = headers['x-rate-limit-interval'];

    if (!limitHeader || !intervalHeader) { return; }

    const nbRequests = Number.parseInt(limitHeader, 10);
    const interval   = Number.parseInt(intervalHeader, 10); // always in seconds for convenience

    if (!Number.isInteger(nbRequests) || nbRequests <= 0) { return; }
    if (!Number.isInteger(interval) || interval <= 0) { return; }

    const newThrottle = Math.ceil((interval / nbRequests) * 1000);

    if (newThrottle !== throttle) {
      const newRate = Math.ceil((1000 / newThrottle) * 100) / 100;
      const oldRate = Math.ceil((1000 / throttle) * 100) / 100;
      // eslint-disable-next-line max-len
      self.logger.info(`Crossref: throttle changed from ${throttle}ms (${oldRate}q/s) to ${newThrottle}ms (${newRate}q/s)`);
      throttle = newThrottle;
    }
  }

  function handleResponseTime(responseTime) {
    if (minResponseTime < 0 || responseTime < minResponseTime) {
      minResponseTime = responseTime;
      report.set('general', 'crossref-min-response-time', responseTime);
    }
    if (responseTime > maxResponseTime) {
      maxResponseTime = responseTime;
      report.set('general', 'crossref-max-response-time', responseTime);
    }
  }

  function queryCrossref(property, values) {
    report.inc('general', 'crossref-queries');

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      request({
        method: 'GET',
        url: 'https://api.crossref.org/works',
        timeout: 60000,
        headers: queryHeaders,
        json: true,
        qs: {
          filter: values.map(v => `${property}:${v}`).join(','),
          rows: packetSize
        }
      }, (err, response, body) => {
        handleCrossrefRateLimit(response);
        handleResponseTime(Date.now() - startTime);

        if (err) {
          return reject(err);
        }

        const status = response && response.statusCode;

        if (!status) {
          return reject(new Error('request failed with no status code'));
        }
        if (status === 401) {
          return reject(new Error('authentication error (is the token valid?)'));
        }
        if (status >= 400) {
          return reject(new Error(`request failed with status ${status}`));
        }

        const list = body && body.message && body.message.items;

        if (!Array.isArray(list)) {
          return reject(new Error('got invalid response from the API'));
        }

        return resolve(list);
      });
    });
  }

  function cacheResult(id, item) {
    return new Promise((resolve, reject) => {
      if (!id || !item) { return resolve(); }

      cache.set(id, item, (err, result) => {
        if (err) { return reject(err); }
        resolve(result);
      });
    });
  }

  function aggregate(item, ec) {
    if (!item) { return; }

    if (Array.isArray(item['container-title'])) {
      ec['publication_title'] = ec['publication_title'] || item['container-title'][0];
    }
    if (Array.isArray(item['title'])) {
      ec['title'] = ec['title'] || item['title'][0];
    }
    ec['doi'] = ec['doi'] || item['DOI'];
    ec['publisher_name'] = ec['publisher_name'] || item['publisher'];
    ec['type'] = ec['type'] || item['type'];

    if (item['issued'] && item['issued']['date-parts'] && item['issued']['date-parts'][0]) {
      ec['publication_date'] = ec['publication_date'] || item['issued']['date-parts'][0][0];
    }
    if (item['subject'] && Array.isArray(item['subject'])) {
      ec['subject'] = ec['subject'] || item['subject'].join(', ');
    }

    if (Array.isArray(item['issn-type'])) {
      item['issn-type'].forEach((issn) => {
        if (issn.type === 'print') {
          ec['print_identifier'] = ec['print_identifier'] || issn.value;
        } else if (issn.type === 'electronic') {
          ec['online_identifier'] = ec['online_identifier'] || issn.value;
        }
      });
    }
    if (Array.isArray(item['isbn-type'])) {
      item['isbn-type'].forEach((isbn) => {
        if (isbn.type === 'print') {
          ec['print_identifier'] = ec['print_identifier'] || isbn.value;
        } else if (isbn.type === 'electronic') {
          ec['online_identifier'] = ec['online_identifier'] || isbn.value;
        }
      });
    }

    if (includeLicense && item['license']) {
      ec['license'] = JSON.stringify(item['license']);
    }
  }
};
