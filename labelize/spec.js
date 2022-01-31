'use strict';

const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

describe('labelize', () => {
  it('should be disabled', async () => {
    const ec = {
      domain: 'test.test@cnrs.fr'
    };

    // TODO
    // const handle = await contextify(mw);
    // expect(handle).to.be.a('function');
    // handle(ec, () => { });

    expect(ec).to.have.property('domain', 'test.test@cnrs.fr');
  });

  it('should enrich EC with resultField "organization" equal to "Dauphine"', async () => {
    const ec = {
      domain: 'dauphine.org'
    };

    const config = [
      {
        from: 'domain',
        'resultField': 'organization',
        mapping: {
          'psl.fr': 'PSL',
          'paristech.com': 'ParisTech',
          'dauphine.org': 'Dauphine',
          'paris-dauphine.org': 'Dauphine',
        }
      }
    ];

    ezpaarse.config.EZPAARSE_LABELIZE = config;

    const handle = await contextify(mw);
    expect(handle).to.be.a('function');

    handle(ec, () => { });

    expect(ec).to.have.property('domain', 'dauphine.org');
    expect(ec).to.have.property('organization', 'Dauphine');
  });

  // eslint-disable-next-line max-len
  it('should enrich EC with resultField "organization" equal to "Dauphine" and "status" to "OK"', async () => {
    const ec = {
      domain: 'dauphine.org',
      code: '1'
    };

    const config = [
      {
        from: 'domain',
        'resultField': 'organization',
        mapping: {
          'psl.fr': 'PSL',
          'paristech.com': 'ParisTech',
          'dauphine.org': 'Dauphine',
          'paris-dauphine.org': 'Dauphine',
        }
      },
      {
        from: 'code',
        'resultField': 'status',
        mapping: {
          '1': 'OK',
          '2': 'OK',
          '3': 'KO',
        }
      }
    ];

    ezpaarse.config.EZPAARSE_LABELIZE = config;

    const handle = await contextify(mw);
    expect(handle).to.be.a('function');

    handle(ec, () => { });

    expect(ec).to.have.property('domain', 'dauphine.org');
    expect(ec).to.have.property('organization', 'Dauphine');
    expect(ec).to.have.property('code', '1');
    expect(ec).to.have.property('status', 'OK');
  });


  it('should enrich EC with resultField "organization" equal to undefined', async () => {
    const ec = {
      domain: 'cnrs.fr',
    };

    const config = [
      {
        from: 'domain',
        'resultField': 'organization',
        mapping: {
          'psl.fr': 'PSL',
          'paristech.com': 'ParisTech',
          'dauphine.org': 'Dauphine',
          'paris-dauphine.org': 'Dauphine',
        }
      }
    ];

    ezpaarse.config.EZPAARSE_LABELIZE = config;

    const handle = await contextify(mw);
    expect(handle).to.be.a('function');

    handle(ec, () => { });

    expect(ec).to.have.property('domain', 'cnrs.fr');
    expect(ec).to.have.property('organization', undefined);
  });


  describe('Test error in configuration', async () => {
    it('should return HTTP status 400', async () => {
      const config = [
        {
          'resultField': 'organization',
          mapping: {
            'psl.fr': 'PSL',
            'paristech.com': 'ParisTech',
            'dauphine.org': 'Dauphine',
            'paris-dauphine.org': 'Dauphine',
          }
        }
      ];

      ezpaarse.config.EZPAARSE_LABELIZE = config;

      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });

    it('should return HTTP status 400', async () => {
      const config = [
        {
          from: 'domain',
          mapping: {
            'psl.fr': 'PSL',
            'paristech.com': 'ParisTech',
            'dauphine.org': 'Dauphine',
            'paris-dauphine.org': 'Dauphine',
          }
        }
      ];

      ezpaarse.config.EZPAARSE_LABELIZE = config;

      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });

    it('should return HTTP status 400', async () => {
      const config = [
        {
          from: 'domain',
          'resultField': 'organization',
        }
      ];

      ezpaarse.config.EZPAARSE_LABELIZE = config;

      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });
  });
});