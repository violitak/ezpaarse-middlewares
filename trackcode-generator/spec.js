/* eslint max-len: 0 */
'use strict';

const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

const trackcodes = new Map();
const hosts = [
  '140.128.66.101',
  '255.151.247.232',
  '149.87.242.49',
  '170.23.9.187',
  '111.211.91.250'
];

describe('trackcode-generator', () => {
  it('should create trackcode and remove host', async () => {
    const process = await contextify(mw);

    for (const host in hosts) {
      const ec = { host };
      await new Promise(resolve => process(ec, resolve));

      expect(ec).to.have.property('trackcode').that.is.not.empty;
      expect(ec).to.have.property('host').that.is.empty;

      trackcodes.set(host, ec.trackcode);
    }
  });

  it('should use the existing trackcode on next process', async () => {
    const process = await contextify(mw);

    for (const host in hosts) {
      const ec = { host };
      await new Promise(resolve => process(ec, resolve));

      expect(ec).to.have.property('trackcode', trackcodes.get(host));
      expect(ec).to.have.property('host').that.is.empty;
    }
  });
});
