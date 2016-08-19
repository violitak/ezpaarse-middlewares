'use strict';

var istex = require('node-istex');
// loading correspondence file ezpaarse rtype with istex rtype
var data  = require('./istex-rtype.json');
var cache = ezpaarse.lib('cache')('istex');

/**
 * Enrich ECs with istex data
 */
module.exports = function () {
  var self   = this;
  var report = this.report;

  var activated = (this.request.header('istex-enrich') || '').toLowerCase() === 'true';
  if (!activated) { return function (ec, next) { next(); }; }

  var ttl           = parseInt(this.request.header('istex-ttl')) || 3600 * 24 * 7;
  var throttle      = parseInt(this.request.header('istex-throttle')) || 100;
  var paquetSize    = parseInt(this.request.header('istex-paquet-size')) || 150;
  // Minimum number of ECs to keep before resolving them
  var bufferSize    = parseInt(this.request.header('istex-buffer-size')) || 1000;
  var busy          = false;
  var buffer        = [];
  var finalCallback = null;

  if (!cache) {
    var err = new Error('failed to connect to mongodb, cache not available for istex');
    err.status = 500;
    return err;
  }

  report.set('general', 'istex-queries', 0);
  report.set('general', 'istex-fails', 0);

  function getPacket(callback) {
    var packet = [];

    (function checkNextEC() {
      if (packet.length >= paquetSize) { return callback(null, packet); }

      var ec = buffer.shift();
      if (!ec) { return callback(null, packet); }

      if (!ec[0].unitid) {
        ec[1]();
        return checkNextEC();
      }

      cache.get(ec[0].unitid, function (err, cachedDoc) {
        if (cachedDoc) {
          enrichEc(ec, cachedDoc);
          ec[1]();
        } else {
          packet.push(ec);
        }
        checkNextEC();
      });
    })();
  }

  function drainBuffer(callback) {
    if (buffer.length === 0) { return (finalCallback || callback)(); }
    if (buffer.length < bufferSize && !finalCallback) { return callback(); }

    getPacket(function (err, packet) {

      if (packet.length === 0) {
        self.logger.silly('Istex: no unitid in the paquet');
        return setImmediate(function () { drainBuffer(callback); });
      }

      var unitids = packet.map(function (ec) { return ec[0].unitid; });

      report.inc('general', 'Istex-queries');
      self.logger.verbose('Istex: resolving a paquet of %d ECs', packet.length);

      istex.findlot(unitids, function (err, list) {

        if (err || !Array.isArray(list)) {

          if (err) { self.logger.error('Istex: the query failed', err); }
          else     { self.logger.error('Istex: got an invalid response'); }

          report.inc('general', 'Istex-fails');

          packet.forEach(function (ec) { ec[1](); });
          return setTimeout(function() { drainBuffer(callback); }, throttle);
        }

        var notFound = [];
        var results  = list.map(item => item.id);

        packet.forEach(function (ec) {
          var item = results[ec[0].unitid];

          if (item) {
            enrichEc(ec, item);
          } else {
            notFound.push(ec[0].unitid);
          }

          ec[1]();
        });

        function cacheNotFound() {
          var unitid = notFound.pop();
          if (!unitid) { return setTimeout(function() { drainBuffer(callback); }, throttle); }

          cache.set(unitid, {}, function (err) {
            if (err) { report.inc('general', 'istex-cache-fail'); }
            cacheNotFound();
          });
        }

        (function cacheResults() {
          var item = list.pop();
          if (!item) { return cacheNotFound(); }

          cache.set(item.id, item, function (err) {
            if (err) { report.inc('general', 'istex-cache-fail'); }
            cacheResults();
          });
        })();
      });
    });
  }

  /**
   * Enrich ec with api istex and to cache the data in database
   */
  function enrichEc(ec, result) {

    report.inc('general', 'istex-queries');
    // interrogate the api istex for recovered metadata with unitid

    if (result.corpusName) {
      ec[0]['publisher_name'] = result.corpusName;

      if (['EEBO', 'ECCO'].indexOf(ec[0]['publisher_name'].toUpperCase()) >= 0) {
        ec['mime'] = 'TIFF';
      }
    }

    if (result.host) {
      if (result.host.isbn) {
        ec[0]['print_identifier'] = result.host.isbn[0];
      }
      if (result.host.issn) {
        ec[0]['print_identifier'] = result.host.issn[0];
      }
      if (result.host.eisbn) {
        ec[0]['online_identifier'] = result.host.eisbn[0];
      }
      if (result.doi) {
        ec[0].doi = result.doi[0];
      }
      if (result.host.title) {
        ec[0]['publication_title'] = result.host.title;
      }
    }

    if (result.publicationDate) {
      ec[0]['publication_date'] = result.publicationDate;
    } else {
      ec[0]['publication_date'] = result.copyrightDate;
    }


    if (result.genre && result.genre[0]) {
      ec[0]['istex_genre'] = result.genre[0];
      switch (ec[0]['istex_rtype']) {
      case 'fulltext':
        if (data[result.genre[0]] && data[result.genre[0]] !== null) {
          ec[0].rtype = data[result.genre[0]];
        } else {
          ec[0]['rtype'] = 'MISC';
        }
        break;
      case 'metadata':
        ec[0].rtype = 'METADATA';
        break;
      case 'enrichments':
        ec[0].rtype = 'METADATA';
        break;
      default:
        ec[0]['rtype'] = 'MISC';
      }
    }
    if (result.language && result.language[0]) {
      ec[0].language = result.language[0];
    }
  }
  /**
 * enrich ec with cache or api istex
 * @param  {object} ec the EC to process, null if no EC left
 * @param  {Function} next the function to call when we are done with the given EC
 */
  function enrich(ec, next) {
    if (!ec || ec.platform !== 'istex') {
      finalCallback = next;
      if (!busy) { drainBuffer(function () { next(); }); }
      return ;
    }
    if (ec['user-agent'] && ec['user-agent'] === 'ezpaarse') {
      return next(new Error('ec ezpaarse'));
    }

    buffer.push([ec, next]);

    if (buffer.length > bufferSize && !busy) {
      busy = true;
      self.saturate();

      drainBuffer(function () {
        busy = false;
        self.drain();
      });
    }
  }


  return new Promise(function (resolve, reject) {

    cache.checkIndexes(ttl, function (err) {
      if (err) {
        self.logger.error('istex: failed to ensure indexes' + err);
        return reject(new Error('failed to ensure indexes for the cache of istex'));
      }

      resolve(enrich);
    });
  });

};
