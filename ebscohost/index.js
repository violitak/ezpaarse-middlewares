'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Resolve Ebscohost database titles using the officiel short names list
 * https://connect.ebsco.com/s/article/EBSCOhost-Database-Short-Names-List?language=en_US
 */
module.exports = function () {
  let list;

  if (this.job.outputFields.added.indexOf('db_id') === -1) {
    this.job.outputFields.added.push('db_id');
  }
  if (this.job.outputFields.added.indexOf('db_title') === -1) {
    this.job.outputFields.added.push('db_title');
  }

  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(__dirname, 'list.json'), 'utf8', (err, content) => {
      if (err) { return reject(err); }

      try {
        list = JSON.parse(content);
      } catch (e) {
        return reject(e);
      }

      resolve(process);
    });
  });

  function process(ec, next) {
    if (!ec || ec.platform !== 'ebscohost') { return next(); }

    if (ec.db_id && list[ec.db_id.toUpperCase()]) {
      ec['db_title'] = list[ec.db_id.toUpperCase()];
    }

    next();
  }
};
