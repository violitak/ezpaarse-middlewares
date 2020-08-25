'use strict';

/**
* Generate COUNTER 5 compliant session IDs
*/
module.exports = function sessionGenerator() {
  this.logger.verbose('Initializing Session ID Generator');

  const fields = {
    session: 'session_id',
    userid: 'user_id',
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
  if (this.job.outputFields.added.indexOf(fields.userid) === -1) {
    this.job.outputFields.added.push(fields.userid);
  }

  return (ec, next) => {
    if (!ec || ec[fields.session]) {
      return next();
    }

    const date = new Date(ec.timestamp * 1000); // Timestamp is in unix format (seconds)
    let hours = date.getHours();

    if (hours < 10) { hours = `0${hours}`; }

    let userId = ec[fields.user] || ec[fields.cookie];

    if (!userId && ec[fields.host]) {
      userId = `${ec[fields.host]}`;
      if (ec[fields.useragent]) {
        userId += `|${ec[fields.useragent]}`;
      }
    }

    if (userId) {
      ec[fields.userid] = userId;
      ec[fields.session] = `${ec.date}|${hours}|${userId}`;
    }

    next();
  };
};
