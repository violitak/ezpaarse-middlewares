const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

describe('labelize', () => {
  it('should be disabled', async () => {
    const ec = {
      email: "test.test@cnrs.fr"
    };

    // TODO
    // const handle = await contextify(mw);
    // expect(handle).to.be.a('function');
    // handle(ec, () => { });

    expect(ec).to.have.property('email', 'test.test@cnrs.fr');
  });

  it('should enriched with labelize config with 1 args', async () => {
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

  it('should enriched with labelize config with 2 args', async () => {
    const ec = {
      email: "test.test@cnrs.fr",
      type: "random"
    };

    const config = [
      {
        "if": { "field": "email", "value": "cnrs" },
        "set": { "field": "organization", "value": "cnrs" }
      },

      {
        "if": { "field": "type", "value": "random" },
        "set": { "field": "user", "value": "anonyme" }
      }
    ];

    ezpaarse.config.EZPAARSE_LABELIZE = config;

    const handle = await contextify(mw);
    expect(handle).to.be.a('function');

    handle(ec, () => { });

    expect(ec).to.have.property('email', 'test.test@cnrs.fr');
    expect(ec).to.have.property('organization', 'cnrs');
    expect(ec).to.have.property('type', 'random');
    expect(ec).to.have.property('user', 'anonyme');
  });

  it('should enriched with labelize config with 2 args', async () => {
    const ec = {
      email: "test.test@cnrs.fr",
    };

    const config = [
      {
        "if": { "field": "email", "value": "inist" },
        "set": { "field": "organization", "value": "inist" }
      },
    ];

    ezpaarse.config.EZPAARSE_LABELIZE = config;

    const handle = await contextify(mw);
    expect(handle).to.be.a('function');

    handle(ec, () => { });

    expect(ec).to.have.property('email', 'test.test@cnrs.fr');
    expect(ec).to.have.property('organization', '');
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

    it('should return HTTP status 400', async () => {
      const ec = {
        email: "test.test@cnrs.fr",
      };
  
      const config = [{
        "if": { "field": "user", "value": "cnrs" },
        "set": { "field": "organization", "value": "cnrs" }
      }];

      ezpaarse.config.EZPAARSE_LABELIZE = config;

      const handle = await contextify(mw);
      expect(handle).to.be.a('function');

      handle(ec,  () => { });
  
      expect(ec).to.have.property('email', 'test.test@cnrs.fr');
      expect(ec).to.not.have.property('organization');
    });
  });
});