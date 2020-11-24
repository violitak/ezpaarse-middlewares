'use strict';

const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

const privateAddresses = [
  '10.50.40.20',
  '172.16.100.50',
  '192.168.20.140'
];
const externalAddresses = [
  '93.134.102.153',
  '93.25.129.211',
  '115.156.70.158',
  '186.68.161.194',
  '103.75.40.187',
  '87.150.185.38',
  '230.220.163.92',
  '187.98.212.104',
];

describe('on-campus-counter', () => {
  it('should only mark local addresses by default', async () => {
    ezpaarse.config.onCampusCounter = null;
    const handle = await contextify(mw);

    expect(handle).to.be.a('function');

    privateAddresses.forEach(host => {
      const ec = { host };
      handle(ec, () => {});
      expect(ec).to.have.property('on_campus', 'Y');
    });

    externalAddresses.forEach(host => {
      const ec = { host };
      handle(ec, () => {});
      expect(ec).to.have.property('on_campus', 'N');
    });
  });

  it('should mark addresses in custom IP ranges', async () => {
    ezpaarse.config.onCampusCounter = ['115.0.0.0/8', '93.25.0.0/16'];
    const handle = await contextify(mw);

    expect(handle).to.be.a('function');

    // Private network should always be marked
    privateAddresses.forEach(host => {
      const ec = { host };
      handle(ec, () => {});
      expect(ec).to.have.property('on_campus', 'Y');
    });

    externalAddresses.forEach(host => {
      const ec = { host };
      handle(ec, () => {});
      if (ec.host.startsWith('115') || ec.host.startsWith('93.25')) {
        expect(ec).to.have.property('on_campus', 'Y');
      } else {
        expect(ec).to.have.property('on_campus', 'N');
      }
    });
  });

  it('should replace Y/N by the associated campus label', async () => {
    ezpaarse.config.onCampusCounter = [
      { label: 'First Campus', ranges: ['115.0.0.0/8'] },
      { label: 'Second Campus', ranges: ['93.25.0.0/16'] },
    ];
    const handle = await contextify(mw);

    expect(handle).to.be.a('function');

    // Ranges without label should use default value
    privateAddresses.forEach(host => {
      const ec = { host };
      handle(ec, () => {});
      expect(ec).to.have.property('on_campus', 'Y');
    });

    externalAddresses.forEach(host => {
      const ec = { host };
      handle(ec, () => {});

      if (ec.host.startsWith('115')) {
        expect(ec).to.have.property('on_campus', 'First Campus');
      } else if (ec.host.startsWith('93.25')) {
        expect(ec).to.have.property('on_campus', 'Second Campus');
      } else {
        expect(ec).to.have.property('on_campus', 'N');
      }
    });
  });

  it('should use the label for private addresses', async () => {
    ezpaarse.config.onCampusCounter = [
      { label: 'Local Campus', ranges: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'] },
    ];
    const handle = await contextify(mw);

    expect(handle).to.be.a('function');

    privateAddresses.forEach(host => {
      const ec = { host };
      handle(ec, () => {});
      expect(ec).to.have.property('on_campus', 'Local Campus');
    });
  });

  it('should accept single IPs', async () => {
    ezpaarse.config.onCampusCounter = [
      { label: 'Local Campus', ranges: privateAddresses.slice() },
      { label: 'Some Campus', ranges: externalAddresses.slice() },
    ];
    const handle = await contextify(mw);

    expect(handle).to.be.a('function');

    privateAddresses.forEach(host => {
      const ec = { host };
      handle(ec, () => {});
      expect(ec).to.have.property('on_campus', 'Local Campus');
    });
    externalAddresses.forEach(host => {
      const ec = { host };
      handle(ec, () => {});
      expect(ec).to.have.property('on_campus', 'Some Campus');
    });
  });

  describe('should return an error', () => {
    it('if a range is invalid', async () => {
      ezpaarse.config.onCampusCounter = ['115.foobar.16.0'];
      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });

    it('if a campus object has no label', async () => {
      ezpaarse.config.onCampusCounter = [{ ranges: ['115.116.0.0/16'] }];
      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });

    it('if a campus object contains an invalid range', async () => {
      ezpaarse.config.onCampusCounter = [{ label: 'Some Campus',  ranges: ['115.foobar.0.0/16'] }];
      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });
  });
});
