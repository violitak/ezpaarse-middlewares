'use strict';

var crypto = require('crypto');
const co    = require('co');

const cache = ezpaarse.lib('cache')('trackcode-generator');
// On conserve le cache pendant 1 an glissant
const ttl        = 3600 * 24 * 365;

/**
 * Anonymize a list of fields
 */
module.exports = function anonymizer() {
  this.logger.verbose('Initializing Trackcode Generator');

    if (!cache) {
        const err = new Error('failed to connect to mongodb, cache not available for trackcode generator');
        err.status = 500;
        return err;
    }

    let buffer;

    function anonymize(ec, next) {

        if (!ec) {
            return next();
        }

        return co(function* () {

            if (ec.host !== undefined && ec.host !== "") {

                // Récupérer la valeur en cache si elle existe (cache valable 1 an)
                let cachedCode = yield checkCache(ec.host);
                if (cachedCode) {
                    ec['trackcode'] = cachedCode;
                } else {
                    ec['trackcode'] = crypto.createHmac('sha1', buffer).update(ec.host).digest('hex');

                    yield cacheResult(ec.host, ec.trackcode);
                }

                ec['host'] = '';
            } else {
                ec['trackcode'] = crypto.createHmac('sha1', buffer).update(ec.host).digest('hex');
            }

        }).then(next).catch((err) => this.job._stop(err));
    }

    return new Promise(function (resolve, reject) {
        cache.checkIndexes(ttl, function (err) {
            if (err) {
                self.logger.error('trackcode generator: failed to ensure indexes' + err);
                return reject(new Error('failed to ensure indexes for the cache of trackcode generator'));
            }

            crypto.randomBytes(40, function (err, res_buffer) {
                if (err) { return reject(err); }
                buffer = res_buffer;
                resolve(anonymize);
            });
        });
    });
};


function checkCache(identifier) {
    return new Promise((resolve, reject) => {
            if (!identifier) { return resolve(); }

    cache.get(identifier, (err, cachedDocid) => {
        if (err) { return reject(err); }
        resolve(cachedDocid);
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



