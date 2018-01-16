'use strict';

const methal = require('methal');
const co    = require('co');
const cache = ezpaarse.lib('cache')('hal');

/**
 * Enrich ECs with hal data
 */
module.exports = function () {
  const self         = this;
  const report       = this.report;
  const req          = this.request;
  const activated    = /^true$/i.test(req.header('hal-enrich'));
  const cacheEnabled = !/^false$/i.test(req.header('hal-cache'));

  if (!activated) { return function (ec, next) { next(); }; }

  self.logger.verbose('hal cache: %s', cacheEnabled ? 'enabled' : 'disabled');

  const ttl        = parseInt(req.header('hal-ttl')) || 3600 * 24 * 7;
  const throttle   = parseInt(req.header('hal-throttle')) || 100;
  const packetSize = parseInt(req.header('hal-paquet-size')) || 150;
  // Minimum number of ECs to keep before resolving them
  let bufferSize   = parseInt(req.header('hal-buffer-size'));

  if (isNaN(bufferSize)) {
    bufferSize = 1000;
  }

  const buffer = [];
  let busy = false;
  let finalCallback = null;

  if (!cache) {
    const err = new Error('failed to connect to mongodb, cache not available for hal');
    err.status = 500;
    return err;
  }

  report.set('general', 'hal-queries', 0);
  report.set('general', 'hal-fails', 0);

  return new Promise(function (resolve, reject) {
    cache.checkIndexes(ttl, function (err) {
      if (err) {
        self.logger.error('hal: failed to ensure indexes' + err);
        return reject(new Error('failed to ensure indexes for the cache of hal'));
      }

      resolve(process);
    });
  });

  /**
   * enrich ec with cache or api hal
   * @param  {object} ec the EC to process, null if no EC left
   * @param  {Function} next the function to call when we are done with the given EC
   */
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

  function getPacket() {
    const packet = {
      'ecs': [],
      'ids': new Set()
    };

    return co(function* () {

      while (packet.ids.size < packetSize) {
        const [ec, done] = buffer.shift() || [];
        if (!ec) { break; }

        if (ec.platform !== 'hal' || !ec.title_id || ec.idtype !== 'IDENTIFIANT') {
          done();
          continue;
        }

        if (cacheEnabled) {
          const cachedDocid = yield checkCache(ec.title_id);

          if (cachedDocid) {
            ec.docid = cachedDocid;
            done();
            continue;
          }
        }

        packet.ecs.push([ec, done]);
        packet.ids.add(ec.title_id);
      }

      return packet;
    });
  }

  function checkCache(identifier) {
    return new Promise((resolve, reject) => {
      if (!identifier) { return resolve(); }

      cache.get(identifier, (err, cachedDocid) => {
        if (err) { return reject(err); }
        resolve(cachedDocid);
      });
    });
  }

  function drainBuffer(callback) {
    return co(function* () {

      while (buffer.length >= bufferSize || (finalCallback && buffer.length > 0)) {

        const packet = yield getPacket();

        if (packet.ecs.length === 0 || packet.ids.size === 0) {
          self.logger.silly('hal: no IDs in the paquet');
          yield new Promise(resolve => { setImmediate(resolve); });
          continue;
        }

        const maxAttempts = 5;
        const results = new Map();
        let tries = 0;
        let docs;

        while (!docs) {
          if (++tries > maxAttempts) {
            const err = new Error(`Failed to query HAL ${maxAttempts} times in a row`);
            return Promise.reject(err);
          }

          try {
            docs = yield queryHal(Array.from(packet.ids));
          } catch (e) {
            self.logger.error('hal: ', e.message);
          }

          yield wait();
        }

        for (const doc of docs) {
          if (!doc.halId_s) { continue; }

          results.set(doc.halId_s, doc.docid);

          try {
            yield cacheResult(doc.halId_s, doc.docid);
          } catch (e) {
            report.inc('general', 'hal-cache-fail');
          }
        }

        for (const [ec, done] of packet.ecs) {

          if (results.has(ec.title_id)) {
            ec.docid = results.get(ec.title_id);
          } else {
            try {
              cacheResult(ec.title_id, null);
            } catch (e) {
              report.inc('general', 'hal-cache-fail');
            }
          }

          done();
        }
      }
    });
  }

  function wait() {
    return new Promise(resolve => { setTimeout(resolve, throttle); });
  }

  function queryHal(halIds) {
    report.inc('general', 'hal-queries');

    const search = `halId_s:${halIds.map(id => `"${id}"`).join('||')}`;

    return new Promise((resolve, reject) => {
      methal.find(search, { fields: 'docid,halId_s', rows: halIds.length }, (err, docs) => {
        if (err) {
          report.inc('general', 'hal-fails');
          return reject(err);
        }

        if (!Array.isArray(docs)) {
          report.inc('general', 'hal-fails');
          return reject(new Error('invalid response'));
        }

        return resolve(docs);
      });
    });
  }

  function cacheResult(id, doc) {
    return new Promise((resolve, reject) => {
      if (!id || !doc) { return resolve(); }

      cache.set(id, doc, (err, result) => {
        if (err) { return reject(err); }
        resolve(result);
      });
    });
  }
};
