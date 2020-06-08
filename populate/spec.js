'use strict';

const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

describe('populate', () => {
  it('should correctly populate fields', async () => {
    const ec = {};
    const handle = await contextify(mw, ctx => {
      ctx.request.headers['populate-fields'] = '{ "string": "foo", "boolean": true, "number": 5 }';
    });
    await new Promise(resolve => handle(ec, resolve));

    expect(ec).to.have.property('string', 'foo');
    expect(ec).to.have.property('boolean', true);
    expect(ec).to.have.property('number', 5);
  });

  it('should return an error with status 400 in case of bad JSON syntax', async () => {
    const handle = await contextify(mw, ctx => {
      ctx.request.headers['populate-fields'] = '{ string: foo }';
    });

    expect(handle).to.be.an.instanceof(Error);
    expect(handle).to.have.property('status', 400);
  });

  it('should return an error with status 400 if the header is not a JSON object', async () => {
    const handle = await contextify(mw, ctx => {
      ctx.request.headers['populate-fields'] = '123';
    });

    expect(handle).to.be.an.instanceof(Error);
    expect(handle).to.have.property('status', 400);
  });
});
