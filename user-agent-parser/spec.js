/* eslint max-len: 0 */
'use strict';

const { contextify } = require('../mock');
const mw = require('.');
const process = contextify(mw);
const { expect } = require('chai');

const common = [
  ['Chrome', 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'],
  ['Firefox', 'Mozilla/5.0 (Windows NT 6.1; rv:42.0) Gecko/20100101 Firefox/42.0'],
  ['Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Safari/602.1.50'],
  ['Edge', 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393'],
  ['IE', 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'],
  ['Opera', 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36 OPR/43.0.2442.991']
];

const tools = [
  ['Wget', 'Wget/1.17.1 (linux-gnu)'],
  ['Node.js', 'node-istex'],
  ['Python-urllib', 'Python-urllib/3.5'],
  ['Java', 'Java/1.8.0_121']
];

describe('user-agent-parser', () => {
  it('should recognize common user-agents', () => {
    common.forEach(ua => {
      const ec = { 'user-agent': ua[1] };
      process(ec, () => {});
      expect(ec).to.have.property('ua', ua[0]);
    });
  });

  it('should recognize common tools', () => {
    tools.forEach(ua => {
      const ec = { 'user-agent': ua[1] };
      process(ec, () => {});
      expect(ec).to.have.property('ua', ua[0]);
    });
  });

  it('should use "Other" for unrecognized user-agents', () => {
    const ec = { 'user-agent': 'some very uncommon user-agent' };
    process(ec, () => {});
    expect(ec).to.have.property('ua', 'Other');
  });
});
