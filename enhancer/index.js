'use strict';

const mongo = ezpaarse.lib('mongo');

/**
 * Create an EC enhancer
 */
module.exports = function enhancer() {
  const noEnrich = (this.request.header('ezpaarse-enrich') || '').toLowerCase() === 'false';

  if (noEnrich) { return function (ec, next) { next(); }; }

  const report  = this.report;
  const pkbs    = mongo.db ? mongo.db.collection('pkbs') : null;
  const pending = new Set();
  let finalCallback;

  return function enhance(ec, next) {
    if (!ec) {
      if (pending.size === 0) { return next(); }
      return finalCallback = next;
    }

    if (!pkbs) {
      report.inc('general', 'enhancement-errors');
      return next();
    }

    const query = {
      '_platform': ec.platform,
      '$or': [],
      'state': { $ne: 'deleted' }
    };

    if (ec.title_id) {
      query.$or.push({ 'content.json.title_id': ec.title_id });
    }
    if (ec.print_identifier) {
      query.$or.push({ 'content.json.print_identifier': ec.print_identifier });
      query.$or.push({ 'content.json.online_identifier': ec.print_identifier });
    }
    if (ec.online_identifier) {
      query.$or.push({ 'content.json.print_identifier': ec.online_identifier });
      query.$or.push({ 'content.json.online_identifier': ec.online_identifier });
    }
    if (ec.doi) {
      query.$or.push({ 'content.json.doi': ec.doi });
    }
    if (query.$or.length === 0) {
      return next();
    }

    pending.add(ec);

    function release(err) {
      next(err); // eslint-disable-line callback-return
      pending.delete(ec);
      if (pending.size === 0 && finalCallback) { finalCallback(); }
    }

    pkbs.findOne(query, { 'content': 1 }, function (err, entry) {
      if (err) {
        report.inc('general', 'enhancement-errors');
        return release();
      }

      if (entry) {
        const info = entry.content.json;
        for (const prop in info) {
          if (!ec[prop] && info[prop]) { ec[prop] = info[prop]; }
        }
      }

      release();
    });
  };
};
