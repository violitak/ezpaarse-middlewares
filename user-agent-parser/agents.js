'use strict';

/**
 * List of uncommon user agents that are not supported by useragent
 */
module.exports = [
  {
    name: 'Firefox',
    matches: [/^firefox/i]
  },
  {
    name: 'Python',
    matches: [/^python/i]
  },
  {
    name: 'Postman',
    matches: [/^PostmanRuntime\//i]
  },
  {
    name: 'Node.js',
    matches: [/^node(?:-\w+)?/i]
  },
  {
    name: 'LTX71',
    matches: [/ltx71/i]
  }
];
