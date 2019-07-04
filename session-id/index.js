'use strict';

/**
* Generate COUNTER 5 compliant session IDs
*/
module.exports = function sessionGenerator() {
  this.logger.verbose('Initializing Session ID Generator');

  const fields = {
    session: 'session_id',
    user: 'login',
    cookie: 'cookie',
    useragent: 'user-agent',
    host: 'host'
  };

  const customFields = this.request.header('session-id-fields');

  if (customFields) {
    customFields.split(',').map(keyValue => {
      let [key, value] = keyValue.split(':').map(v => v.trim());

      if (key && value && fields[key]) {
        fields[key] = value;
      }
    });
  }

  this.logger.verbose(Object.entries(fields).map(e => e.join(': ')).join(', '));

  if (this.job.outputFields.added.indexOf(fields.session) === -1) {
    this.job.outputFields.added.push(fields.session);
  }

  return (ec, next) => {
    if (!ec || ec[fields.session]) {
      return next();
    }

    const date = new Date(ec.timestamp * 1000); // Timestamp is in unix format (seconds)
    let hours = date.getHours();

    if (hours < 10) { hours = `0${hours}`; }
    if (ec[fields.user]) {
      ec[fields.session] = `${ec.date}|${hours}|${ec[fields.user]}`;
    } else if (ec[fields.cookie]) {
      ec[fields.session] = `${ec.date}|${hours}|${ec[fields.cookie]}`;
    } else if (ec[fields.host] && ec[fields.useragent]) {
      ec[fields.session] = `${ec.date}|${hours}|${ec.host}|${ec[fields.useragent]}`;
    }

    next();
  };
};
