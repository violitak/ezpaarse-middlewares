const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

describe('labelize', () => {
  it('should be disabled', async () => {
    ezpaarse.config.EZPAARSE_LABELIZE = null;
  });

  it('should enriched with labelize config', async () => {
    const ec = {
      email: "test.test@cnrs.fr"
    };

    const config = [
      {
        "if": { "field": "email", "value": "cnrs" },
        "set": { "field": "organization", "value": "cnrs" }
      }
    ];

    ezpaarse.config.EZPAARSE_LABELIZE = config;

    const handle = await contextify(mw);
    expect(handle).to.be.a('function');

    handle(ec, () => { });

    expect(ec).to.have.property('email', 'test.test@cnrs.fr');
    expect(ec).to.have.property('organization', 'cnrs');
  });

  it('should enriched with labelize config', async () => {
    const ec = {
      email: "test.test@cnrs.fr"
    };

    const config = [
      {
        "if": { "field": "email", "value": "cnrs" },
        "set": { "field": "organization", "value": "cnrs" }
      },

      {
        "if": { "field": "email", "value": "test.test" },
        "set": { "field": "user", "value": "test.test" }
      }
    ];

    ezpaarse.config.EZPAARSE_LABELIZE = config;

    const handle = await contextify(mw);
    expect(handle).to.be.a('function');

    handle(ec, () => { });

    expect(ec).to.have.property('email', 'test.test@cnrs.fr');
    expect(ec).to.have.property('organization', 'cnrs');
    expect(ec).to.have.property('user', 'test.test');
  });



  describe('Test error in configuration', async () => {
    it('should return HTTP status 400', async () => {
      const config = {
        "if": { "field": "email", "value": "cnrs" },
        "set": { "field": "organization", "value": "cnrs" }
      };

      ezpaarse.config.EZPAARSE_LABELIZE = config;

      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });

    it('should return HTTP status 400', async () => {
      const config = [
        {
          "set": { "field": "organization", "value": "cnrs" }
        }
      ];

      ezpaarse.config.EZPAARSE_LABELIZE = config;

      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });

    it('should return HTTP status 400', async () => {
      const config = [
        {
          "set": { "field": "organization" },
          "if": { "field": "email", "value": "cnrs" }
        }
      ];

      ezpaarse.config.EZPAARSE_LABELIZE = config;

      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });

    it('should return HTTP status 400', async () => {
      const config = [
        {
          "set": { "value": "cnrs" },
          "if": { "field": "email", "value": "cnrs" }
        }
      ];

      ezpaarse.config.EZPAARSE_LABELIZE = config;

      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });

    it('should return HTTP status 400', async () => {
      const config = [
        {
          "if": { "field": "email", "value": "cnrs" },
        }
      ];

      ezpaarse.config.EZPAARSE_LABELIZE = config;

      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });

    it('should return HTTP status 400', async () => {
      const config = [
        {
          "set": { "field": "organization", "value": "cnrs" },
          "if": { "field": "email" },
        }
      ];

      ezpaarse.config.EZPAARSE_LABELIZE = config;

      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });

    it('should return HTTP status 400', async () => {
      const config = [
        {
          "set": { "field": "organization", "value": "cnrs" },
          "if": { "value": "cnrs" },
        }
      ];

      ezpaarse.config.EZPAARSE_LABELIZE = config;

      const handle = await contextify(mw);
      expect(handle).to.be.an('error').that.has.property('status', 400);
    });
  });
});