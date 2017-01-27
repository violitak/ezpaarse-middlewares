/*eslint global-require: 0*/
'use strict';
var path = require('path');

var prefixexist = false;
var prefixLogin = '';

// test id file prefix login exist
try {
  prefixLogin = require(path.resolve(__dirname, '../..', ezpaarse.config.PREFIX_LOGIN));
  prefixexist =  true;
} catch (e) {
  prefixexist =  false;
}

/**
 * cut fields login
 */
module.exports = function () {
  var activated        = (this.request.header('cut') || '').toLowerCase() === 'true';
  var cutField         = this.request.header('cut-field') || '';
  var cutRegex         = this.request.header('cut-regex') || '';
  var cutFieldsCreated = this.request.header('cut-create-fields') || '';

  if (!activated) { return function (ec, next) { next(); }; }

  var newFields = cutFieldsCreated.split(',');

  newFields.forEach(field => {
    if (this.job.outputFields.added.indexOf(field) === -1) {
      this.job.outputFields.added.push(field);
    }
  });

  // return function has a work to cut fields login and create new fields with result cutting
  return function cut(ec, next) {
    if (ec) {
      // check if file prefix exist
      if (ec.login) {
        if (prefixexist) {
          var prefix = '';
          for (var i = 0; i< ec['login'].length; i++) {
            prefix = prefix + ec['login'].substr(i, 1);
            if (prefixLogin[prefix.toUpperCase()] === prefix) {
              ec['OU'] = ec['login'].substr(i+1, ec['login'].length);
              break;
            }
          }
        }
        // check if login is a mail regulèrie  expression
        if (/([\w\W]+)@([\w\W]+)/.test(ec['login'])) {
          ec['OU'] = ec['login'];
        }
      }

      // cutting fields defined in header with a regex and put a value in new fields
      if (cutField && cutRegex && newFields.length > 0) {
        var regfields = new RegExp(cutRegex);
        var match = '';
        if (ec[cutField]) {
          if ((match = regfields.exec(ec[cutField])) !== null) {

            for (var j = 0; j < newFields.length; j++) {
              ec[newFields[j]] = match[j + 1];
            }
          }
        }
      }
    }

    next();
  };
};
