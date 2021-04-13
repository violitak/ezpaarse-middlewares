'use strict';

const co = require('co');
const request = require('request');
const { bufferedProcess, wait } = require('../utils.js');
const cache = ezpaarse.lib('cache')('ezunpaywall');

// result field => ec field
const enrichmentFields = {
  'journal_name': 'publication_title',
  'is_oa': 'is_oa',
  'journal_is_in_doaj': 'journal_is_in_doaj',
  'journal_is_oa': 'journal_is_oa',
  'oa_status': 'oa_status',
  'updated': 'oa_updated',
  'oa_request_date': 'oa_request_date'
};

const graphqlFields = Object.keys(enrichmentFields).filter(k => k !== 'oa_request_date');
graphqlFields.push('doi');

module.exports = function () {
  this.logger.verbose('Initializing ezunpaywall middleware');

  const logger = this.logger;
  const report = this.report;
  const req    = this.request;

  const cacheEnabled = !/^false$/i.test(req.header('ezunpaywall-cache'));

  logger.verbose(`Unpaywall cache: ${cacheEnabled ? 'enabled' : 'disabled'}`);

  // Time-to-live of cached documents
  let ttl = parseInt(req.header('ezunpaywall-ttl'));
  // Minimum wait time before each request (in ms)
  let throttle = parseInt(req.header('ezunpaywall-throttle'));
  // Maximum number of DOIs to query
  let packetSize = parseInt(req.header('ezunpaywall-packet-size'));
  // Minimum number of ECs to keep before resolving them
  let bufferSize = parseInt(req.header('ezunpaywall-buffer-size'));

  if (isNaN(packetSize)) { packetSize = 100; }
  if (isNaN(bufferSize)) { bufferSize = 1000; }
  if (isNaN(throttle)) { throttle = 100; }
  if (isNaN(ttl)) { ttl = 3600 * 24 * 7; }

  if (!cache) {
    const err = new Error('failed to connect to mongodb, cache not available for Unpaywall');
    err.status = 500;
    return err;
  }

  Object.values(enrichmentFields).forEach(field => {
    if (this.job.outputFields.added.indexOf(field) === -1) {
      this.job.outputFields.added.push(field);
    }
  });

  report.set('general', 'ezunpaywall-queries', 0);
  report.set('general', 'ezunpaywall-query-fails', 0);
  report.set('general', 'ezunpaywall-cache-fails', 0);

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
        logger.error(`Unpaywall: failed to verify indexes : ${err}`);
        return reject(new Error('failed to verify indexes for the cache of Unpaywall'));
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
        const err = new Error(`Failed to query Unpaywall ${maxAttempts} times in a row`);
        return Promise.reject(err);
      }

      try {
        docs = yield query(dois);
      } catch (e) {
        logger.error(`Unpaywall: ${e.message}`);
      }

      yield wait(throttle);
    }

    const doiResults = new Map();
    docs.forEach(doc => doiResults.set(doc.doi, doc));

    for (const [ec, done] of ecs) {
      const doc = doiResults.get(ec.doi);

      try {
        // If we can't find a result for a given ID, we cache an empty document
        yield cacheResult(ec.doi, doc || {});
      } catch (e) {
        report.inc('general', 'ezunpaywall-cache-fails');
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
    Object.entries(enrichmentFields).forEach(([field, ecField]) => {
      if (Object.hasOwnProperty.call(result, field)) {
        ec[ecField] = result[field];
      }
    });
  }

  /**
   * Request metadata from Unpaywall API for a given DOI
   * @param {Array} dois the doi to query
   */
  function query(dois) {
    report.inc('general', 'ezunpaywall-queries');

    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        uri: 'http://vdunpaywallmir.intra.inist.fr:8080/graphql',
        json: true,
        body: {
          query: `{
            getDataUPW(dois:${JSON.stringify(dois)}) {
              ${graphqlFields.join(',')}
            }
          }`,
        }
      };

      const now = new Date();

      request(options, (err, response, body) => {
        if (err) {
          report.inc('general', 'ezunpaywall-query-fails');
          return reject(err);
        }

        if (response.statusCode === 404) {
          return resolve({});
        }

        if (response.statusCode !== 200 && response.statusCode !== 304) {
          report.inc('general', 'ezunpaywall-query-fails');
          return reject(new Error(`${response.statusCode} ${response.statusMessage}`));
        }

        const result = body && body.data && body.data.getDataUPW;

        if (!Array.isArray(result)) {
          return reject(new Error('invalid response'));
        }

        resolve(result.map(result => {
          result['oa_request_date'] = now.toISOString();
          return result;
        }));
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
