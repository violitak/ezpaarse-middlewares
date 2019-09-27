'use strict';

const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

const ecTemplate = {
  host: '140.128.66.101',
  login: 'john.doo',
  platform: 'wiley'
};

describe('anonymizer', () => {
  it('should crypt host and login by default', async () => {
    const ec = JSON.parse(JSON.stringify(ecTemplate));
    const handle = await contextify(mw);
    await new Promise(resolve => handle(ec, resolve));

    expect(ec).to.have.property('platform', 'wiley');
    expect(ec).to.have.property('host').that.is.not.equal('140.128.66.101');
    expect(ec).to.have.property('login').that.is.not.equal('john.doo');
  });

  it('should crypt host and login by default', async () => {
    const ec = JSON.parse(JSON.stringify(ecTemplate));
    const handle = await contextify(mw);
    await new Promise(resolve => handle(ec, resolve));

    expect(ec).to.have.property('platform', 'wiley');
    expect(ec).to.have.property('host').that.is.not.equal('140.128.66.101');
    expect(ec).to.have.property('login').that.is.not.equal('john.doo');
  });

  it('should not crypt anything if set to disabled', async () => {
    const ec = JSON.parse(JSON.stringify(ecTemplate));
    const handle = await contextify(mw, ctx => {
      ctx.request.headers['crypted-fields'] = 'disabled';
    });
    await new Promise(resolve => handle(ec, resolve));

    for (const [key, value] of Object.entries(ecTemplate)) {
      expect(ec).to.have.property(key, value);
    }
  });

  it('should crypt differently accross jobs', async () => {
    const ec1 = JSON.parse(JSON.stringify(ecTemplate));
    const ec2 = JSON.parse(JSON.stringify(ecTemplate));
    const handle1 = await contextify(mw);
    const handle2 = await contextify(mw);

    await new Promise(resolve => handle1(ec1, resolve));
    await new Promise(resolve => handle2(ec2, resolve));

    expect(ec1).to.have.property('host').which.is.not.equal(ecTemplate.host);
    expect(ec2).to.have.property('host').which.is.not.equal(ecTemplate.host);
    expect(ec1.host).to.not.equal(ec2.host);
  });

  it('should crypt the same way if a salt is provided', async () => {
    const ec1 = JSON.parse(JSON.stringify(ecTemplate));
    const ec2 = JSON.parse(JSON.stringify(ecTemplate));
    const handle1 = await contextify(mw, ctx => {
      ctx.request.headers['crypting-salt'] = 'foobar';
    });
    const handle2 = await contextify(mw, ctx => {
      ctx.request.headers['crypting-salt'] = 'foobar';
    });

    await new Promise(resolve => handle1(ec1, resolve));
    await new Promise(resolve => handle2(ec2, resolve));

    expect(ec1).to.have.property('host').which.is.not.equal(ecTemplate.host);
    expect(ec2).to.have.property('host').which.is.not.equal(ecTemplate.host);
    expect(ec1.host).to.equal(ec2.host);
  });
});
