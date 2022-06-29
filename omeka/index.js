'use strict';

const co = require('co');
const request = require('request');
const { bufferedProcess, wait } = require('../utils.js');
const cache = ezpaarse.lib('cache')('omeka');

const platforms = require('./platforms.json');

module.exports = function () {
  const logger = this.logger;
  const report = this.report;
  const req = this.request;

  logger.info('Initializing omeka middleware');

  const cacheEnabled = !/^false$/i.test(req.header('omeka-cache'));

  logger.info(`Omeka cache: ${cacheEnabled ? 'enabled' : 'disabled'}`);

  // Time-to-live of cached documents
  let ttl = parseInt(req.header('omeka-ttl'));
  // Minimum wait time before each request (in ms)
  let throttle = parseInt(req.header('omeka-throttle'));
  // Maximum enrichment attempts
  let maxTries = parseInt(req.header('omeka-max-tries'));
  // Base wait time after a request fails
  let baseWaitTime = parseInt(req.header('omeka-base-wait-time'));

  const platform = req.header('omeka-platform');
  if (!platform) {
    const err = new Error('Omeka: no platform are sent');
    err.status = 500;
    return err;
  }

  if (!platforms[platform]) {
    const err = new Error(`Omeka: unrecognized platform [${platform}]`);
    err.status = 500;
    return err;
  }

  let baseUrl = platforms[platform];

  let key = req.header('omeka-key');

  if (isNaN(baseWaitTime)) { baseWaitTime = 1000; }
  if (isNaN(throttle)) { throttle = 100; }
  if (isNaN(ttl)) { ttl = 3600 * 24 * 7; }

  if (!cache) {
    const err = new Error('failed to connect to mongodb, cache not available for Omeka');
    err.status = 500;
    return err;
  }

  report.set('omeka', 'omeka-queries', 0);
  report.set('omeka', 'omeka-query-fails', 0);
  report.set('omeka', 'omeka-cache-fails', 0);
  report.set('omeka', 'omeka-count-ark', 0);
  report.set('omeka', 'omeka-count-id', 0);

  const process = bufferedProcess(this, {
    /**
     * Filter ECs that should be enriched
     * @param {Object} ec
     * @returns {Boolean|Promise} true if the EC should be enriched, false otherwise
     */
    filter: ec => {
      if (!ec.unitid) { return false; }
      if (!cacheEnabled) { return true; }

      return findInCache(`${baseUrl}/${ec.ark || ec.unitid}`).then(cachedDoc => {
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
      const ark = ec.ark;
      let id;

      if (!ark) {
        id = ec.unitid;
      }

      let tries = 0;
      let doc;

      while (!doc) {
        if (tries >= maxTries) {
          const err = new Error(`Failed to query API Omeka ${maxTries} times in a row`);
          return Promise.reject(err);
        }

        try {
          doc = yield query(baseUrl, ark, id);
        } catch (e) {
          logger.error(`Omeka: ${e.message}`);
        }

        yield wait(tries === 0 ? throttle : baseWaitTime * Math.pow(2, tries));

        tries += 1;
      }


      try {
        // If we can't find a result for a given ID, we cache an empty document
        yield cacheResult(`${baseUrl}/${ark || ec.unitid}`, doc || {});
      } catch (e) {
        report.inc('omeka', 'omeka-cache-fails');
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
    if (result && Array.isArray(result.element_texts)) {
      const title = result.element_texts.find((res) => {
        return res && res.text && res.element && res.element.name === 'Title';
      });
      if (title) {
        ec['publication_title'] = title.text;
      }
    }
  }

  /**
   * Request metadata from OMEKA API for a given ARK
   * @param {String} ark the ark to query
   * @param {String} id the id to query
   */
  function query(baseUrl, ark, id) {
    report.inc('omeka', 'omeka-queries');
    const qs = {};
    if (ark) qs.search = ark;
    if (key) qs.key = key;

    return new Promise((resolve, reject) => {

      const options = {
        method: 'GET',
        json: true,
        uri: ark ? `${baseUrl}/api/items` : `${baseUrl}/api/items/${id}`,
        qs
      };

      logger.info(JSON.stringify(options, null, 2));
      if (ark) {
        report.inc('omeka', 'omeka-count-ark');
      } else {
        report.inc('omeka', 'omeka-count-id');
      }

      request(options, (err, response, body) => {
        if (err) {
          report.inc('omeka', 'omeka-query-fails');
          return reject(err);
        }

        if (response.statusCode === 404) {
          return resolve({});
        }

        if (response.statusCode !== 200 && response.statusCode !== 304) {
          report.inc('omeka', 'omeka-query-fails');
          return reject(new Error(`${response.statusCode} ${response.statusMessage}`));
        }



        if (Array.isArray(body)) {
          if (body.length !== 0) {
            body = body[0];
          } else {
            return resolve({});
          }
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
