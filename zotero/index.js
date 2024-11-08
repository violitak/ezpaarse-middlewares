'use strict';

const co = require('co');
const request = require('request');
const { bufferedProcess, wait } = require('../utils.js');
const cache = ezpaarse.lib('cache')('zotero');

// result field => ec field
const enrichmentFields = {
  'DOI': 'zotero_doi',
  'ISSN': 'zotero_issn',
  'title': 'zotero_title',
};

module.exports = function () {
  this.logger.verbose('Initializing zotero middleware');

  const logger = this.logger;
  const report = this.report;
  const req = this.request;

  const cacheEnabled = !/^false$/i.test(req.header('zotero-cache'));

  logger.verbose(`Zotero cache: ${cacheEnabled ? 'enabled' : 'disabled'}`);

  // Time-to-live of cached documents
  let ttl = parseInt(req.header('zotero-ttl'));
  // Minimum wait time before each request (in ms)
  let throttle = parseInt(req.header('zotero-throttle'));
  // Maximum number of URLs to query
  let packetSize = parseInt(req.header('zotero-packet-size'));
  // Minimum number of ECs to keep before resolving them
  let bufferSize = parseInt(req.header('zotero-buffer-size'));
  // Maximum number of trials before passing the EC in error
  let maxAttempts = parseInt(req.header('zotero-max-attempts'));


  if (isNaN(packetSize)) { packetSize = 10; }
  if (isNaN(bufferSize)) { bufferSize = 200; }
  if (isNaN(throttle)) { throttle = 100; }
  if (isNaN(ttl)) { ttl = 3600 * 24 * 7; }
  if (isNaN(maxAttempts)) { maxAttempts = 5; }

  if (!cache) {
    const err = new Error('failed to connect to mongodb, cache not available for Zotero');
    err.status = 500;
    return err;
  }

  Object.values(enrichmentFields).forEach(field => {
    if (this.job.outputFields.added.indexOf(field) === -1) {
      this.job.outputFields.added.push(field);
    }
  });

  report.set('general', 'zotero-queries', 0);
  report.set('general', 'zotero-query-fails', 0);
  report.set('general', 'zotero-cache-fails', 0);

  const process = bufferedProcess(this, {
    packetSize,
    bufferSize,

    /**
     * Filter ECs that should be enriched
     * @param {Object} ec
     * @returns {Boolean|Promise} true if the EC should be enriched, false otherwise
     */
    filter: ec => {
      if (!cacheEnabled) { return true; }

      return findInCache(ec.doi).then(cachedDoc => {
        if (cachedDoc) {
          enrichEc(ec, cachedDoc);
          return false;
        }
        return true;
      });
    },

    onPacket: co.wrap(onPacket)
  });

  return new Promise(function (resolve, reject) {
    // Verify cache indices and time-to-live before starting
    cache.checkIndexes(ttl, function (err) {
      if (err) {
        logger.error(`Zotero: failed to verify indexes : ${err}`);
        return reject(new Error('failed to verify indexes for the cache of Zotero'));
      }

      resolve(process);
    });
  });

  /**
   * Process a packet of ECs
   * @param {Array<Object>} ecs
   * @param {Map<String, Set<String>>} groups
   */
  function* onPacket({ ecs }) {
    if (ecs.length === 0) { return; }

    yield Promise.all(ecs.map(([ec, done]) => co.wrap(processEc)(ec, done)));
  }

  /**
   * Enrich an EC using the result of a query
   * @param {Object} ec the EC to be enriched
   * @param {Object} result the document used to enrich the EC
   */
  function enrichEc(ec, result) {
    Object.entries(enrichmentFields).forEach(([field, ecField]) => {
      if (Object.hasOwnProperty.call(result, field)) {
        ec[ecField] = result[field];
      }
    });
  }

  /**
   * Process and enrich one EC
   * @param {Object} ec the EC to process
   * @param {Function} done the callback
   */
  function* processEc(ec, done) {
    let tries = 0;
    let result;

    while (typeof result === 'undefined') {
      if (++tries > maxAttempts) {
        const err = new Error(`Failed to query Zotero ${maxAttempts} times in a row`);
        return Promise.reject(err);
      }

      try {
        result = yield query(ec.url);
      } catch (e) {
        logger.error(`Zotero: ${e.message}`);
      }

      yield wait(throttle);
    }

    try {
      // If we can't find a result for a given DOI, we cache an empty document
      yield cacheResult(ec.doi, result || {});
    } catch (e) {
      report.inc('general', 'zotero-cache-fails');
    }

    if (result) {
      enrichEc(ec, result);
    }

    done();
  }

  /**
   * Request metadata from Zotero API for a given URL
   * @param {String} url the url to query
   */
  function query(url) {
    report.inc('general', 'zotero-queries');

    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        uri: `http://zotero:1969/web`,
        headers: {
          'Content-Type': 'text/plain',
        },
        body: url,
      };

      const now = new Date();

      request(options, (err, response, body) => {
        if (err) {
          report.inc('general', 'zotero-query-fails');
          return reject(err);
        }

        if (response.statusCode === 404) {
          return resolve({});
        }

        if (response.statusCode !== 200 && response.statusCode !== 304) {
          report.inc('general', 'zotero-query-fails');
          return reject(new Error(`${response.statusCode} ${response.statusMessage}`));
        }

        let result;
        try {
          result = JSON.parse(body);
        } catch (e) {
          return reject(e);
        }

        resolve(result.shift());
      });
    });
  }

  /**
  * Cache an item with a given ID
  * @param {String} id the ID of the item
  * @param {Object} item the item to cache
  */
  function cacheResult(id, item) {
    return new Promise((resolve, reject) => {
      if (!id || !item) { return resolve(); }

      // The entire object can be pretty big
      // We only cache what we need to limit memory usage
      const cached = {};

      Object.keys(enrichmentFields).forEach(field => {
        if (Object.hasOwnProperty.call(item, field)) {
          cached[field] = item[field];
        }
      });

      cache.set(id, cached, (err, result) => {
        if (err) { return reject(err); }
        resolve(result);
      });
    });
  }

  /**
   * Find the item associated with a given ID in the cache
   * @param {String} identifier the ID to find in the cache
   */
  function findInCache(identifier) {
    return new Promise((resolve, reject) => {
      if (!identifier) { return resolve(); }

      cache.get(identifier, (err, cachedDoc) => {
        if (err) { return reject(err); }
        resolve(cachedDoc);
      });
    });
  }
};
