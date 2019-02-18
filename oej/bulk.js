'use strict';

const co = require('co');
const request = require('request');
const { bufferedProcess, wait } = require('../utils.js');
const cache = ezpaarse.lib('cache')('oej');

module.exports = function () {
  this.logger.verbose('Initializing OEJ');

  const logger       = this.logger;
  const report       = this.report;
  const req          = this.request;
  const cacheEnabled = !/^false$/i.test(req.header('oej-cache'));

  logger.verbose(`OEJ cache: ${cacheEnabled ? 'enabled' : 'disabled'}`);

  // Time-to-live of cached documents
  let ttl = parseInt(req.header('oej-ttl'));
  // Minimum wait time before each request (in ms)
  let throttle = parseInt(req.header('oej-throttle'));
  // Maximum number of different lodel IDs to query at once
  let packetSize = parseInt(req.header('oej-paquet-size'));
  // Minimum number of ECs to keep before resolving them
  let bufferSize = parseInt(req.header('oej-buffer-size'));

  if (isNaN(bufferSize)) { bufferSize = 1000; }
  if (isNaN(packetSize)) { packetSize = 150; }
  if (isNaN(throttle)) { throttle = 100; }
  if (isNaN(ttl)) { ttl = 3600 * 24 * 7; }

  if (!cache) {
    const err = new Error('failed to connect to mongodb, cache not available for OEJ');
    err.status = 500;
    return err;
  }

  report.set('general', 'oej-accesses', 0);
  report.set('general', 'oej-queries', 0);
  report.set('general', 'oej-query-fails', 0);
  report.set('general', 'oej-cache-fails', 0);

  const process = bufferedProcess(this, {
    packetSize,
    bufferSize,

    /**
     * Filter ECs that should be enriched
     * @param {Object} ec
     * @returns {Boolean|Promise} true if the EC should be enriched, false otherwise
     */
    filter: ec => {
      if (!ec.lodelid) { return false; }
      if (!ec.title_id) { return false; }
      if (!cacheEnabled) { return true; }

      return findInCache(`${ec.title_id}/${ec.lodelid}`).then(cachedDoc => {
        if (cachedDoc) {
          enrichEc(ec, cachedDoc);
          return false;
        }
        return true;
      });
    },

    // Group ECs by Sitename/LodelID couple
    groupBy: ec => `${ec.title_id}/${ec.lodelid}`,

    onPacket: co.wrap(onPacket)
  });

  return new Promise(function (resolve, reject) {
    // Verify cache indices and time-to-live before starting
    cache.checkIndexes(ttl, function (err) {
      if (err) {
        logger.error(`OEJ: failed to ensure indexes : ${err}`);
        return reject(new Error('failed to ensure indexes for the cache of OEJ'));
      }

      resolve(process);
    });
  });

  /**
   * Process a packet of ECs
   * @param {Array<Object>} ecs
   * @param {Map<String, Array<Object>>} groups ECs grouped
   */
  function* onPacket({ ecs, groups }) {
    const ids = Array.from(groups.keys()); // Set of different Sitename/LodelID couples

    const maxAttempts = 5;
    const results = new Map();
    let tries = 0;
    let list;

    while (!list) {
      if (++tries > maxAttempts) {
        const err = new Error(`Failed to query OpenEdition ${maxAttempts} times in a row`);
        return Promise.reject(err);
      }

      try {
        list = yield query(ids);
      } catch (e) {
        logger.error(`OEJ: ${e.message}`);
      }

      yield wait(throttle);
    }

    // Index results by ID for faster searching
    for (const item of list.filter(item => item.id)) {
      results.set(item.lodelid, item);

      try {
        yield cacheResult(`${item.sitename}/${item.lodelid}`, item);
      } catch (e) {
        report.inc('general', 'oej-cache-fails');
      }
    }

    for (const [ec, done] of ecs) {

      if (results.has(ec.lodelid)) {
        enrichEc(ec, results.get(ec.unitid));
      } else {
        try {
          // If we can't find a result for a given ID, we cache an empty document
          yield cacheResult(`${ec.title_id}/${ec.lodelid}`, {});
        } catch (e) {
          report.inc('general', 'oej-cache-fails');
        }
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
    ec['publication_date'] = result.publicationDate;
    ec.type = result.type;
  }

  /**
   * Find metadata from OpenEdition API
   * @param {Array<String>} ids list of Sitename/LodelId couples
   */
  function query(ids) {
    return new Promise((resolve, reject) => {
      const uri = 'http://core.openedition.org/';
      const qs = {
        action: 'get',
        format: 'json',
        url: `http://journals.openedition.org/${sitename}/${lodelid}`
      };

      qs.url = '(';
      qs.url += ids.map(id => `http://journals.openedition.org/${id}`).join(' OR ');
      qs.url += ')';

      request({ method: 'GET', uri, qs }, (err, response, body) => {
        if (err) {
          report.inc('general', 'oej-query-fails');
          return reject(err);
        }

        if (response.statusCode !== 200 || response.statusCode !== 304) {
          report.inc('general', 'oej-query-fails');
          return reject(new Error(`${response.statusCode} ${response.statusMessage}`));
        }

        let result;
        try {
          result = JSON.parse(body);
        } catch (e) {
          return reject(e);
        }

        if (!Array.isArray(result && result.hits)) {
          report.inc('general', 'oej-query-fails');
          return reject(new Error('invalid response'));
        }

        resolve(result.hits);
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
      const cached = {
        publicationDate: item.publicationDate,
        type: item.type
      };

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
