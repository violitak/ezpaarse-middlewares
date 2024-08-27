'use strict';

const istex = require('node-istex').defaults({ extraQueryString: { sid: 'ezpaarse' }});
const co    = require('co');
const data  = require('./istex-rtype.json'); // matching between ezPAARSE and Istex types
const cache = ezpaarse.lib('cache')('istex');

const tiffCorpus = new Set(['EEBO', 'ECCO']);


const fields = [
  'publicationDate',
  'copyrightDate',
  'corpusName',
  'language',
  'genre',
  'host',
  'doi',
  'arkIstex'
];


/**
 * Enrich ECs with istex data
 */
module.exports = function () {
  const self         = this;
  const report       = this.report;
  const req          = this.request;
  const activated    = /^true$/i.test(req.header('istex-enrich'));
  const cacheEnabled = !/^false$/i.test(req.header('istex-cache'));

  if (!activated) { return function (ec, next) { next(); }; }

  self.logger.verbose('Istex cache: %s', cacheEnabled ? 'enabled' : 'disabled');

  const ttl        = parseInt(req.header('istex-ttl')) || 3600 * 24 * 7;
  const throttle   = parseInt(req.header('istex-throttle')) || 100;
  const packetSize = parseInt(req.header('istex-paquet-size')) || 150;
  // Minimum number of ECs to keep before resolving them
  let bufferSize   = parseInt(req.header('istex-buffer-size'));

  if (isNaN(bufferSize)) {
    bufferSize = 1000;
  }

  const buffer = [];
  let busy = false;
  let finalCallback = null;

  if (!cache) {
    const err = new Error('failed to connect to mongodb, cache not available for istex');
    err.status = 500;
    return err;
  }

  report.set('general', 'istex-queries', 0);
  report.set('general', 'istex-fails', 0);

  return new Promise(function (resolve, reject) {
    cache.checkIndexes(ttl, function (err) {
      if (err) {
        self.logger.error('istex: failed to ensure indexes' + err);
        return reject(new Error('failed to ensure indexes for the cache of istex'));
      }

      resolve(process);
    });
  });

  /**
   * enrich ec with cache or api istex
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

    if (/ezpaarse/i.test(ec['user-agent']) || /ezpaarse/i.test(ec.sid)) {
      return next(new Error('ec ezpaarse'));
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

        if (ec.platform !== 'istex' || !ec.unitid) {
          done();
          continue;
        }

        if (cacheEnabled) {
          const cachedDoc = yield checkCache(ec.unitid);

          if (cachedDoc) {
            enrichEc(ec, cachedDoc);
            done();
            continue;
          }
        }

        packet.ecs.push([ec, done]);
        packet.ids.add(ec.unitid);
      }

      return packet;
    });
  }

  function checkCache(identifier) {
    return new Promise((resolve, reject) => {
      if (!identifier) { return resolve(); }

      cache.get(identifier, (err, cachedDoc) => {
        if (err) { return reject(err); }
        resolve(cachedDoc);
      });
    });
  }

  function drainBuffer(callback) {
    return co(function* () {

      while (buffer.length >= bufferSize || (finalCallback && buffer.length > 0)) {

        const packet = yield getPacket();

        if (packet.ecs.length === 0 || packet.ids.size === 0) {
          self.logger.silly('Istex: no IDs in the paquet');
          yield new Promise(resolve => { setImmediate(resolve); });
          continue;
        }

        const maxAttempts = 5;
        const results = new Map();
        let tries = 0;
        let list;

        while (!list) {
          if (++tries > maxAttempts) {
            const err = new Error(`Failed to query Istex ${maxAttempts} times in a row`);
            return Promise.reject(err);
          }

          try {
            list = yield queryIstex(Array.from(packet.ids));
          } catch (e) {
            self.logger.error('Istex: ', e.message);
          }

          yield wait();
        }

        for (const item of list) {
          if (item.id) {
            results.set(item.id, item);

            try {
              yield cacheResult(item.id, item);
            } catch (e) {
              report.inc('general', 'istex-cache-fail');
            }
          }

          if (item.arkIstex) {
            results.set(item.arkIstex, item);

            try {
              yield cacheResult(item.arkIstex, item);
            } catch (e) {
              report.inc('general', 'istex-cache-fail');
            }
          }
        }

        for (const [ec, done] of packet.ecs) {

          if (results.has(ec.unitid)) {
            enrichEc(ec, results.get(ec.unitid));
          } else {
            try {
              cacheResult(ec.unitid, {});
            } catch (e) {
              report.inc('general', 'istex-cache-fail');
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

  function queryIstex(ids) {
    report.inc('general', 'istex-queries');

    const subQueries = [];
    const istexIds   = [];
    const arks       = [];

    ids.forEach(id => {
      /^ark:/i.test(id) ? arks.push(id) : istexIds.push(id);
    });

    if (istexIds.length > 0) {
      subQueries.push(`id:(${istexIds.join(' OR ')})`);
    }

    if (arks.length > 0) {
      subQueries.push(`arkIstex:("${arks.join('" OR "')}")`);
    }

    const size = subQueries.length;
    const output = fields.join(',');
    const q = subQueries.join(' OR ');

    const query = `?size=${size}&output=${output}&q=${q}`;

    return new Promise((resolve, reject) => {
      istex.find(query, (err, result) => {
        if (err) {
          report.inc('general', 'istex-fails');
          return reject(err);
        }

        if (!Array.isArray(result && result.hits)) {
          report.inc('general', 'istex-fails');
          return reject(new Error('invalid response'));
        }

        return resolve(result.hits);
      });
    });
  }

  function cacheResult(id, item) {
    return new Promise((resolve, reject) => {
      if (!id || !item) { return resolve(); }

      // The entire object can be pretty big
      // We only cache what we need to limit memory usage
      const cached = {
        publicationDate: item.publicationDate,
        copyrightDate:   item.copyrightDate,
        corpusName:      item.corpusName,
        language:        item.language,
        genre:           item.genre,
        host:            item.host,
        doi:             item.doi
      };

      cache.set(id, cached, (err, result) => {
        if (err) { return reject(err); }
        resolve(result);
      });
    });
  }

  /**
   * Enrich ec with api istex and to cache the data in database
   */
  function enrichEc(ec, result) {
    const {
      publicationDate,
      copyrightDate,
      corpusName,
      language,
      genre,
      host,
      doi,
      arkIstex
    } = result;

    if (corpusName) {
      ec['publisher_name'] = corpusName;

      if (tiffCorpus.has(corpusName.toUpperCase())) {
        ec['mime'] = 'TIFF';
      }
    }

    if (host) {
      if (host.isbn)    { ec['print_identifier']  = getValue(host.isbn); }
      if (host.issn)    { ec['print_identifier']  = getValue(host.issn); }
      if (host.eisbn)   { ec['online_identifier'] = getValue(host.eisbn); }
      if (host.eissn)   { ec['online_identifier'] = getValue(host.eissn); }
      if (host.title)   { ec['publication_title'] = getValue(host.title); }
      if (host.subject && host.subject.value) { ec['subject'] = getValue(host.subject).value; }
    }

    ec['publication_date'] = publicationDate || copyrightDate;

    if (doi)      { ec['doi']         = getValue(doi); }
    if (arkIstex) { ec['ark']         = getValue(arkIstex); }
    if (genre)    { ec['istex_genre'] = getValue(genre); }
    if (language) { ec['language']    = getValue(language); }

    switch (ec['istex_rtype']) {
    case 'fulltext':
      ec['rtype'] = data[genre] || 'MISC';
      break;
    case 'metadata':
    case 'enrichments':
    case 'record':
      ec['rtype'] = 'METADATA';
      break;
    default:
      ec['rtype'] = 'MISC';
    }
  }
};

/**
 * Returns the first element if the parameter is an array
 * Otherwise returns the parameter as is
 */
function getValue(o) {
  return Array.isArray(o) ? o[0] : o;
}
