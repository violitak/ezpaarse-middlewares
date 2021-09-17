'use strict';

const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

const usescases = [
  {
    host: '106.208.192.206',
    first: '106.208.192.206',
    last: '106.208.192.206',
  }, {
    host: '21.204.64.111,210.161.217.124',
    first: '21.204.64.111',
    last: '210.161.217.124',
  }, {
    host: '229.197.180.114, 220.182.203.43, 210.161.217.124',
    first: '229.197.180.114',
    last: '210.161.217.124',
  },
];

describe('host-chain', () => {
  it('should extract first IP', () => {
    usescases.forEach(({ host, first }) => {
      const ec = { host };
      const process = contextify(mw);
      process(ec, () => {});

      expect(ec).to.have.property('full_host', host);
      expect(ec).to.have.property('host', first);
    });
  });

  it('should extract last IP', () => {
    usescases.forEach(({ host, last }) => {
      const ec = { host };
      const process = contextify(mw, ctx => {
        ctx.request.headers['host-chain-real-position'] = 'last';
      });
      process(ec, () => {});

      expect(ec).to.have.property('full_host', host);
      expect(ec).to.have.property('host', last);
    });
  });

  it('should support custom fields', () => {
    usescases.forEach(({ host, first }) => {
      const ec = { 'ip_client': host };
      const process = contextify(mw, ctx => {
        ctx.request.headers['host-chain-field'] = 'ip_client';
        ctx.request.headers['host-chain-full-field'] = 'all_hosts';
      });
      process(ec, () => {});

      expect(ec).to.have.property('all_hosts', host);
      expect(ec).to.have.property('ip_client', first);
    });
  });

  it('should support custom separator', () => {
    usescases.forEach(({ host: hostWithComma, first }) => {
      const host = hostWithComma.replace(/,/g, '+');

      const ec = { host };
      const process = contextify(mw, ctx => {
        ctx.request.headers['host-chain-separator'] = '+';
      });
      process(ec, () => {});

      expect(ec).to.have.property('full_host', host);
      expect(ec).to.have.property('host', first);
    });
  });
});
