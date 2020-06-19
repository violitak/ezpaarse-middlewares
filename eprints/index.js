'use strict';

const request = require('request');
const co = require('co');
const cache = ezpaarse.lib('cache')('eprints');
const { bufferedProcess, wait } = require('../utils.js');
const parseString = require('xml2js').parseString;

// result field => ec field
const enrichmentFields = {
  'dc:title': 'publication_title',
  'dc:date': 'publication_date',
  'dc:relation': 'doi',
  'dc:publisher': 'publisher_name',
  'dc:language': 'language'
};

const resultFields = ['GetRecord','record','metadata','oai_dc:dc'];

module.exports = function eprints() {
  this.logger.verbose('Initializing eprints middleware');

  const logger = this.logger;
  const report = this.report;
  const req    = this.request;

  const cacheEnabled = !/^false$/i.test(req.header('eprints-cache'));

  logger.verbose(`eprints cache: ${cacheEnabled ? 'enabled' : 'disabled'}`);
  // Time-to-live of cached documents
  let ttl = parseInt(req.header('eprints-ttl'));
  // Minimum wait time before each request (in ms)
  let throttle = parseInt(req.header('eprints-throttle'));
  // Maximum number of DOIs to query
  let packetSize = parseInt(req.header('eprints-packet-size'));
  // Minimum number of ECs to keep before resolving them
  let bufferSize = parseInt(req.header('eprints-buffer-size'));
  // Domain name eprints platform
  const domainName = req.header('eprints-domain-name');

  if (isNaN(packetSize)) { packetSize = 10; }
  if (isNaN(bufferSize)) { bufferSize = 200; }
  if (isNaN(throttle)) { throttle = 100; }
  if (isNaN(ttl)) { ttl = 3600 * 24 * 7; }

  if (!cache) {
    const err = new Error('failed to connect to mongodb, cache not available for eprints');
    err.status = 500;
    return err;
  }

  if (!/^(http|https):\/\//i.test(domainName) || !domainName) {
    const err = new Error('domain name invalid');
    err.status = 500;
    return err;
  }

  Object.values(enrichmentFields).forEach(field => {
    if (this.job.outputFields.added.indexOf(field) === -1) {
      this.job.outputFields.added.push(field);
    }
  });

  report.set('general', 'eprints-queries', 0);
  report.set('general', 'eprints-query-fails', 0);
  report.set('general', 'eprints-cache-fails', 0);
  report.set('general', 'eprints-item-deleted',0);
  report.set('general', 'eprints-miss-id',0);

  const process = bufferedProcess(this, {
    packetSize,
    bufferSize,

    /**
     * Filter ECs that should be enriched
     * @param {Object} ec
     * @returns {Boolean|Promise} true if the EC should be enriched, false otherwise
     */
    filter: ec => {
      if (!ec.unitid) { return false; }
      if (!cacheEnabled) { return true; }

      const unitid = ec.unitid.split('/');
      if (!unitid.length) { return false; }

      return findInCache(unitid.shift()).then(cachedDoc => {
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
        logger.error(`Eprints: failed to verify indexes : ${err}`);
        return reject(new Error('failed to verify indexes for the cache of Eprints'));
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
        ec[ecField] = result[field][0].replace(/(\r\n|\n|\r)/gm, ' ');
      }
    });
  }

  /**
   * Process and enrich one EC
   * @param {Object} ec the EC to process
   * @param {Function} done the callback
   */
  function* processEc (ec, done) {
    const maxAttempts = 5;
    let tries = 0;
    let result;

    while (typeof result === 'undefined') {
      if (++tries > maxAttempts) {
        const err = new Error(`Failed to query eprints ${maxAttempts} times in a row`);
        return Promise.reject(err);
      }

      try {
        result = yield query(ec.unitid.split('/')[0]);
      } catch (e) {
        logger.error(`eprints: ${e.message}`);
      }

      yield wait(throttle);
    }

    try {
      // If we can't find a result for a given ID, we cache an empty document
      yield cacheResult(ec.unitid.split('/')[0], result || {});
    } catch (e) {
      report.inc('general', 'eprints-cache-fails');
    }
    if (result) {
      enrichEc(ec, result);
    }

    done();
  }

  /**
   * Request metadata from OAI-PMH API for a given ID
   * @param {String} id the id to query
   */
  function query (id) {
    report.inc('general', 'eprints-queries');
    return new Promise((resolve, reject) => {
      const hostname = new URL(domainName).hostname;

      const options = {
        method: 'GET',
        uri: `${domainName}/cgi/oai2`,
        qs: {
          verb: 'GetRecord',
          metadataPrefix: 'oai_dc',
          identifier: `oai:${hostname}:${id}`,
        },
      };

      request(options, (err, res, body) => {
        if (err) {
          report.inc('general', 'eprints-query-fails');
          return reject(err);
        }

        parseString(body, function (err, result) {
          if (err) {
            report.inc('general', 'eprints-query-fails');
            return reject(err);
          }

          if (result.statusCode === 404) {
            return resolve({});
          }

          if (result['OAI-PMH'].hasOwnProperty('error')) {
            report.inc('general', 'eprints-miss-id');
            logger.error(`${id} id does not exist`);
            return resolve({});
          }

          if (!verifFields(result['OAI-PMH'])) {
            report.inc('general', 'eprints-query-fails');
            return reject(new Error('incorrect field'));
          }

          if (!result['OAI-PMH'].GetRecord[0].record[0].hasOwnProperty('metadata')) {
            report.inc('general', 'eprints-item-deleted');
            return resolve({});
          }

          resolve(result['OAI-PMH'].GetRecord[0].record[0].metadata[0]['oai_dc:dc'][0]);
        });
      });
    });
  }

  /**
   * Verifies that the fields of the result are valid
   * @param {Object} res the result to verify
   */
  function verifFields(res) {
    resultFields.forEach(function(field){
      if(res.hasOwnProperty(field)){
        res =res[field][0];
      }else{
        return false;
      }
    })
    return true;
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
