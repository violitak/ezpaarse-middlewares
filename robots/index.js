'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Detect robots by counting accesses
 */
module.exports = function () {
  const report  = this.report;
  const req     = this.request;
  const jobPath = this.job.jobPath;
  const logger  = this.logger;

  const cache = ezpaarse.lib('cache')(`robots-${this.job.jobID}`);
  const ttl = parseInt(req.header('robots-ttl')) || 3600 * 24;
  const threshold = parseInt(req.header('robots-threshold')) || 100;

  if (!cache) {
    const err = new Error('failed to connect to mongodb, cache not available for robots');
    err.status = 500;
    return err;
  }

  /**
   * Log if the logger is writable
   * @param {String} type the log type
   * @param {...*} args the arguments to log
   */
  function log(type, ...args) {
    if (logger.writable) {
      logger[type](...args);
    }
  }

  return new Promise(function (resolve, reject) {
    cache.checkIndexes(ttl, function (err) {
      if (err) {
        log('error', `robots: failed to ensure indexes : ${err}`);
        return reject(new Error('failed to ensure indexes for the cache of robots'));
      }

      resolve(process);
    });
  });

  /**
   * Count accesses
   * @param  {object} ec the EC to process, null if no EC left
   * @param  {Function} next the function to call when we are done with the given EC
   */
  function process(ec, next) {
    if (!ec) {
      return persist(() => {
        clearCache(() => next(null));
      });
    }

    const trackCode = ec['trackcode'];
    if (!trackCode) { return next(); }

    increment(trackCode, true, next);
  }

  /**
   * Increment counter for a given trackcode
   * @param {String} trackCode
   * @param {Boolean} retry  retry in case of error, workaround for concurrent upserts
   * @param {Function} callback
   */
  function increment(trackCode, retry, callback) {
    cache.collection.updateOne(
      { id: trackCode },
      { $inc: { counter: 1 } },
      { upsert: true }
    )
      .then(() => callback())
      .catch((err) => {
        if (retry) {
          increment(trackCode, false, callback);
          return;
        }
        log('error', `robots: failed to increment count for "${trackCode}": ${err}`);
        callback();
      });
  }

  /**
   * Clear the collection
   * @param {Function} callback
   */
  function clearCache(callback) {
    cache.collection.drop()
      .catch((err) => log('error', `robots: failed to clear cache: ${err}`))
      .finally(() => callback());
  }

  /**
   * Get track codes with high number of accesses and persist them into a file
   * @param {Function} callback
   */
  function persist(callback) {
    log('info', 'robots: persisting file');

    cache.collection.find({ counter: { $gt: threshold } })
      .project({ _id: 0, id: 1, counter: 1 })
      .toArray()
      .then((docs) => {
        report.set('general', 'robots-number', docs.length);
        log('info', `robots: found ${docs.length}`);
        fs.writeFile(path.resolve(jobPath, 'robots.json'), JSON.stringify(docs, null, 2), err => {
          if (err) {
            log('error', 'robots: failed to persist robots');
          } else {
            log('info', 'robots: file written');
          }
          return callback();
        });
      })
      .catch((err) => {
        log('error', `robots: failed to persist robots: ${err}`);
        return callback();
      });
  }
};

