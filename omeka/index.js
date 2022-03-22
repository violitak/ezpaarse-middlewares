'use strict';

const co = require('co');
const request = require('request');
const { bufferedProcess, wait } = require('../utils.js');
const cache = ezpaarse.lib('cache')('omeka');


module.exports = function () {
  const logger = this.logger;
  const report = this.report;
  const req = this.request;

  logger.verbose('Initializing omeka middleware');

  const cacheEnabled = !/^false$/i.test(req.header('omeka-cache'));

  logger.verbose(`Omeka cache: ${cacheEnabled ? 'enabled' : 'disabled'}`);

  // Time-to-live of cached documents
  let ttl = parseInt(req.header('omeka-ttl'));
  // Minimum wait time before each request (in ms)
  let throttle = parseInt(req.header('omeka-throttle'));

  let baseUrl = req.header('omeka-baseUrl');

  if (isNaN(throttle)) { throttle = 100; }
  if (isNaN(ttl)) { ttl = 3600 * 24 * 7; }

  if (!cache) {
    const err = new Error('failed to connect to mongodb, cache not available for Omeka');
    err.status = 500;
    return err;
  }

  report.set('general', 'omeka-queries', 0);
  report.set('general', 'omeka-query-fails', 0);
  report.set('general', 'omeka-cache-fails', 0);

  const process = bufferedProcess(this, {
    /**
     * Filter ECs that should be enriched
     * @param {Object} ec
     * @returns {Boolean|Promise} true if the EC should be enriched, false otherwise
     */
    filter: ec => {
      if (!ec.ark) { return false; }
      if (!ec.unitid) { return false; }
      if (!cacheEnabled) { return true; }

      return findInCache(`${ec.unitid}/${ec.ark}`).then(cachedDoc => {
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
        logger.error(`Omeka: failed to verify indexes : ${err}`);
        return reject(new Error('failed to verify indexes for the cache of Omeka'));
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
      const ark = ec.title_id;

      const maxAttempts = 5;
      let tries = 0;
      let doc;

      while (!doc) {
        if (++tries > maxAttempts) {
          const err = new Error(`Failed to query API Omeka ${maxAttempts} times in a row`);
          return Promise.reject(err);
        }

        try {
          doc = yield query(baseUrl, ark);
        } catch (e) {
          logger.error(`Omeka: ${e.message}`);
        }

        yield wait(throttle);
      }


      try {
        // If we can't find a result for a given ID, we cache an empty document
        yield cacheResult(`${baseUrl}/${ark}`, doc || {});
      } catch (e) {
        report.inc('general', 'omeka-cache-fails');
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
    ec['publication_title'] = result.element_text.filter((res) => {
      if (res.element.name === 'Title') return res.text;
    });
    ec.type = result.type;
  }

  /**
   * Request metadata from OMEKA API for a given ARK
   * @param {String} ark the ark to query
   */
  function query(baseUrl, ark) {
    report.inc('general', 'omeka-queries');
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        uri: `${baseUrl}/api/items?search=${ark}`,
        json: true,
      };

      const now = new Date();

      request(options, (err, response, body) => {
        if (err) {
          report.inc('general', 'omeka-query-fails');
          return reject(err);
        }

        if (response.statusCode === 404) {
          return resolve({});
        }

        if (response.statusCode !== 200 && response.statusCode !== 304) {
          report.inc('general', 'omeka-query-fails');
          return reject(new Error(`${response.statusCode} ${response.statusMessage}`));
        }

        const result = body && body.data && body.data[0];

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
