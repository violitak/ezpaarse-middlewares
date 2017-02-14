'use strict';

var hostlocalize = ezpaarse.lib('hostlocalize.js');

/**
 * Geolocalize ECs
 */
module.exports = function localizer() {
  this.logger.verbose('Initializing geolocation');

  var job = this.job;
  job.outputFields = job.outputFields || { added: [], removed: [] };

  var geolocalize = ezpaarse.config.EZPAARSE_GEOLOCALIZE_DEFAULT;
  var geoFields   = (this.request.header('Geoip') || '').toLowerCase();

  this.logger.verbose('Geolocalization fields : ', geoFields);
  this.report.set('general', 'geolocalization', geoFields);

  if (geoFields === 'none') {
    geolocalize = false;

  } else if (geoFields === 'all') {
    hostlocalize.geoipFields.forEach(function (field) {
      if (job.outputFields.added.indexOf(field) === -1) { job.outputFields.added.push(field); }
    });

  } else if (geoFields) {
    this.logger.verbose('Fields header: ' + geoFields);

    var fields = geoFields.split(',');
    for (var i = 0, l = fields.length; i < l; i++) {
      var field = fields[i].trim();

      // control requested fields
      if (!field || hostlocalize.geoipFields.indexOf(field) === -1) {
        var err    = new Error();
        err.code   = 4019;
        err.status = 400;
        return err;
      }
      if (job.outputFields.added.indexOf(field) === -1) {
        job.outputFields.added.push(field);
      }
    }
  } else {
    this.logger.verbose('Using geoip default fields (' +
      hostlocalize.geoipDefaultFields.join(', ') + ')');

    hostlocalize.geoipDefaultFields.forEach(function (field) {
      if (job.outputFields.added.indexOf(field) === -1) { job.outputFields.added.push(field); }
    });
  }

  return function localize(ec, next) {
    if (!geolocalize || !ec) { return next(); }

    hostlocalize.resolve(ec.host, job, function (geo) {
      for (var p in geo) {
        ec[p] = geo[p];
      }
      next();
    });
  };
};
