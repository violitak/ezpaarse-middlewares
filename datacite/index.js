'use strict';

const co = require('co');
const request = require('request');
const { bufferedProcess, wait } = require('../utils.js');
const cache = ezpaarse.lib('cache')('datacite');

module.exports = function () {
  this.logger.verbose('Initializing datacite middleware');

  const logger = this.logger;
  const report = this.report;
  const req = this.request;

  const cacheEnabled = !/^false$/i.test(req.header('datacite-cache'));

  logger.verbose(`Datacite cache: ${cacheEnabled ? 'enabled' : 'disabled'}`);

  // Time-to-live of cached documents
  let ttl = parseInt(req.header('datacite-ttl'));
  // Minimum wait time before each request (in ms)
  let throttle = parseInt(req.header('datacite-throttle'));
  // Maximum number of DOIs to query
  let packetSize = parseInt(req.header('datacite-packet-size'));
  // Minimum number of ECs to keep before resolving them
  let bufferSize = parseInt(req.header('datacite-buffer-size'));

  if (isNaN(packetSize)) { packetSize = 10; }
  if (isNaN(bufferSize)) { bufferSize = 1000; }
  if (isNaN(throttle)) { throttle = 100; }
  if (isNaN(ttl)) { ttl = 3600 * 24 * 7; }

  if (!cache) {
    const err = new Error('failed to connect to mongodb, cache not available for Datacite');
    err.status = 500;
    return err;
  }

  report.set('datacite', 'queries', 0);
  report.set('datacite', 'query-fails', 0);
  report.set('datacite', 'cache-fails', 0);

  const process = bufferedProcess(this, {
    packetSize,
    bufferSize,

    /**
     * Filter ECs that should be enriched
     * @param {Object} ec
     * @returns {Boolean|Promise} true if the EC should be enriched, false otherwise
     */
    filter: ec => {
      if (!ec.doi) { return false; }
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
        logger.error(`Datacite: failed to verify indexes : ${err}`);
        return reject(new Error('failed to verify indexes for the cache of Datacite'));
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

    const dois = ecs.map(([ec, done]) => ec.doi);

    const maxAttempts = 5;
    let tries = 0;
    let docs;

    while (!docs) {
      if (++tries > maxAttempts) {
        const err = new Error(`Failed to query Datacite ${maxAttempts} times in a row`);
        return Promise.reject(err);
      }

      try {
        docs = yield query(dois);
      } catch (e) {
        logger.error(`Datacite: ${e.message}`);
      }

      yield wait(throttle);
    }

    const doiResults = new Map();
    docs.forEach(doc => doiResults.set(doc.id, doc));

    for (const [ec, done] of ecs) {
      const doc = doiResults.get(ec.doi);

      try {
        // If we can't find a result for a given ID, we cache an empty document
        yield cacheResult(ec.doi, doc || {});
      } catch (e) {
        report.inc('datacite', 'cache-fails');
      }

      if (doc) {
        enrichEc(ec, doc);
      }

      done();
    }
  }

  /**
   * Enrich an EC using the result of a query
   * @param {Object} ec the EC to be enriched
   * @param {Object} result the document used to enrich the EC
   */
  function enrichEc(ec, result) {
    const titleData = result.attributes.titles.find((res) => {
      return res && res.title;
    });

    if (titleData) {
      ec['publication_title'] = titleData.title;
    }
  }

  /**
   * Request metadata from Datacite API for a given DOI
   * @param {Array} dois the doi to query
   */
  function query(dois) {
    report.inc('datacite', 'queries');

    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        uri: `https://api.datacite.org/dois?query=id:(${dois.join(' OR ')})&page[size]=${dois.length}`,
        json: true
      };

      request(options, (err, response, body) => {
        if (err) {
          report.inc('datacite', 'query-fails');
          return reject(err);
        }

        if (response.statusCode === 404) {
          return resolve({});
        }

        if (response.statusCode !== 200 && response.statusCode !== 304) {
          report.inc('datacite', 'query-fails');
          return reject(new Error(`${response.statusCode} ${response.statusMessage}`));
        }

        const result = body && body.data;

        if (!Array.isArray(result)) {
          return reject(new Error('invalid response'));
        }

        return resolve(result);
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


      cache.set(id, item, (err, result) => {
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
