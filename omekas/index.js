'use strict';

const co = require('co');
const request = require('request');
const { bufferedProcess, wait } = require('../utils.js');
const cache = ezpaarse.lib('cache')('omekas');

const platforms = require('./platforms.json');

module.exports = function () {
  const logger = this.logger;
  const report = this.report;
  const req = this.request;

  logger.info('Initializing omekas middleware');

  const cacheEnabled = !/^false$/i.test(req.header('omekas-cache'));

  logger.info(`Omekas cache: ${cacheEnabled ? 'enabled' : 'disabled'}`);

  // Time-to-live of cached documents
  let ttl = parseInt(req.header('omekas-ttl'));
  // Minimum wait time before each request (in ms)
  let throttle = parseInt(req.header('omekas-throttle'));

  const platform = req.header('omekas-platform');
  if (!platform) {
    const err = new Error('Omekas: no platform are sent');
    err.status = 400;
    return err;
  }

  if (!platforms[platform]) {
    const err = new Error(`Omekas: unrecognized platform [${platform}]`);
    err.status = 400;
    return err;
  }

  let baseUrl = platforms[platform];

  let key = req.header('omekas-key');

  if (isNaN(throttle)) { throttle = 100; }
  if (isNaN(ttl)) { ttl = 3600 * 24 * 7; }

  if (!cache) {
    const err = new Error('failed to connect to mongodb, cache not available for Omekas');
    err.status = 500;
    return err;
  }

  report.set('omekas', 'omekas-queries', 0);
  report.set('omekas', 'omekas-query-fails', 0);
  report.set('omekas', 'omekas-cache-fails', 0);
  report.set('omekas', 'omekas-count-id', 0);

  const process = bufferedProcess(this, {
    /**
     * Filter ECs that should be enriched
     * @param {Object} ec
     * @returns {Boolean|Promise} true if the EC should be enriched, false otherwise
     */
    filter: ec => {
      if (!ec.unitid) { return false; }
      if (!cacheEnabled) { return true; }

      let [ , id] = ec.unitid.split('-');

      return findInCache(`${baseUrl}/${id}`).then(cachedDoc => {
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
        logger.error(`Omekas: failed to verify indexes : ${err}`);
        return reject(new Error('failed to verify indexes for the cache of Omekas'));
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
    for (const [ec, done] of ecs) {
      let [ , id] = ec.unitid.split('-');

      const maxAttempts = 5;
      let tries = 0;
      let doc;

      while (!doc) {
        if (++tries > maxAttempts) {
          const err = new Error(`Failed to query API Omekas ${maxAttempts} times in a row`);
          return Promise.reject(err);
        }

        try {
          doc = yield query(baseUrl, id);
        } catch (e) {
          logger.error(`Omekas: ${e.message}`);
        }

        yield wait(throttle);
      }


      try {
        // If we can't find a result for a given ID, we cache an empty document
        yield cacheResult(`${baseUrl}/${id}`, doc || {});
      } catch (e) {
        report.inc('omekas', 'omekas-cache-fails');
      }
      enrichEc(ec, doc);
      done();
    }
  }

  /**
   * Enrich an EC using the result of a query
   * @param {Object} ec the EC to be enriched
   * @param {Object} result the document used to enrich the EC
   */
  function enrichEc(ec, result) {
    if (result['o:title']) {
      ec['publication_title'] = result['o:title'];
    }
    if (result['dcterms:identifier'] && result['dcterms:identifier'].length > 0) {
      ec['ark'] = result['dcterms:identifier'][0]['@value'] || '';
    }
  }

  /**
   * Request metadata from OMEKAs API for a given ID
   * @param {String} id the id to query
   */
  function query(baseUrl, id) {
    report.inc('omekas', 'omekas-queries');
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        json: true,
        uri: `${baseUrl}/api/items/${id}`,
      };
      report.inc('omekas', 'omekas-count-id');

      request(options, (err, response, body) => {
        if (err) {
          report.inc('omekas', 'omekas-query-fails');
          return reject(err);
        }

        if (response.statusCode === 404) {
          return resolve({});
        }

        if (response.statusCode !== 200 && response.statusCode !== 304) {
          report.inc('omekas', 'omekas-query-fails');
          return reject(new Error(`${response.statusCode} ${response.statusMessage}`));
        }

        if (Array.isArray(body)) {
          body = body[0];
        }

        return resolve(body);
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
