'use strict';

const fs = require('fs');
const path = require('path');
const request = require('request');

/**
 * Mark ECs as robots if their user-agent string match a regex in the COUNTER robot list
 * Fetch the list from github with a cache for one day, and fallback to a local copy if needed
 * https://github.com/atmire/COUNTER-Robots/blob/master/generated/COUNTER_Robots_list.txt
 */
module.exports = function () {
  const job = this.job;
  const req = this.request;
  const logger = this.logger;
  let regs;

  const timeout = parseInt(req.header('robot-refresh-timeout')) || 5000;

  return new Promise((resolve, reject) => {
    getRemoteList({ timeout, logger })
      .catch(err => {
        logger.warn(`Failed to fetch remote robot list : ${err.message}`);
        return getLocalList();
      })
      .then((content) => {
        regs = generateRegexList(content);
        resolve(process);
      })
      .catch(err => {
        err.message = `Failed to fetch local robot list : ${err.message}`;
        reject(err);
      });
  });

  function process(ec, next) {
    if (!ec || !ec['user-agent']) { return next(); }

    const isRobot = regs.some(reg => reg.test(ec['user-agent']));
    ec.robot = isRobot ? 'yes' : 'no';

    if (isRobot && job.filters.robots) {
      const err = new Error('host detected as a robot');
      err.type = 'EROBOT';
      return next(err);
    }

    next();
  }
};

/**
 * Get the list from the local file
 */
function getLocalList() {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(__dirname, 'list.txt'), 'utf8', (err, content) => {
      if (err) { reject(err); }
      else { resolve(content); }
    });
  });
}

// eslint-disable-next-line max-len
const listUrl = 'https://raw.githubusercontent.com/atmire/COUNTER-Robots/master/generated/COUNTER_Robots_list.txt';
const oneDay = 24 * 60 * 60 * 1000;
let remoteList = null;
let lastRefresh = Date.now();

/**
 * Get the list from GitHub
 */
function getRemoteList({ timeout, logger }) {
  return new Promise((resolve, reject) => {
    if (remoteList && ((Date.now() - lastRefresh) < oneDay)) { return resolve(remoteList); }

    logger.info('Refreshing robots list');

    request({
      method: 'GET',
      uri: listUrl,
      timeout
    }, (err, response, body) => {
      if (err) { return reject(err); }

      if ([200, 304].indexOf(response.statusCode) === -1) {
        return reject(new Error(`${response.statusCode} ${response.statusMessage}`));
      }

      remoteList = body.trim();

      if (!remoteList) {
        return reject(new Error('response body is empty'));
      }

      lastRefresh = Date.now();
      resolve(remoteList);
    });
  });
}

/**
 * Take a string with a regular expression on each line and return an array of regex
 * @param {String} content a list of regular expressions separated by new lines
 * @returns {Array<RegExp>}
 */
function generateRegexList (content) {
  if (typeof content !== 'string' || content.length === 0) { return []; }

  return content.split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return new RegExp(line.trim(), 'i');
      } catch (e) {
        return null;
      }
    })
    .filter(line => line);
}
