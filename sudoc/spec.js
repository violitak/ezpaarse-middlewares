'use strict';

const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

describe('sudoc', () => {
  it('should correctly convert ISSN to PPN', async () => {
    const process = await contextify(mw, ctx => {
      ctx.request.headers['sudoc-enrich'] = 'true';
    });

    const ec = { 'print_identifier': '1879-2065' };
    await new Promise(resolve => process(ec, resolve));

    expect(ec).to.have.property('sudoc-ppn').that.equals('083506357');
  });
});
