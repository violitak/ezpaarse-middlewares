/* eslint max-len: 0 */
'use strict';

const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

const tests = [
  {
    fields: 'session:sid',
    ec: {
      host: '140.128.66.101',
      'user-agent': 'mozilla',
      login: 'john.doo',
      date: '2019-05-05',
      timestamp: '1557058490'
    },
    sessionId: {
      name: 'sid',
      value: '2019-05-05|14|john.doo'
    }
  },
  {
    fields: null,
    ec: {
      host: '140.128.66.101',
      'user-agent': 'mozilla',
      login: 'john.doo',
      date: '2019-05-05',
      timestamp: '1557058490'
    },
    sessionId: {
      name: 'session_id',
      value: '2019-05-05|14|john.doo'
    }
  },
  {
    fields: 'user:user',
    ec: {
      host: '140.128.66.101',
      'user-agent': 'mozilla',
      user: 'john.doo',
      date: '2019-05-05',
      timestamp: '1557058490'
    },
    sessionId: {
      name: 'session_id',
      value: '2019-05-05|14|john.doo'
    }
  },
  {
    fields: null,
    ec: {
      host: '140.128.66.101',
      'user-agent': 'mozilla',
      date: '2019-05-05',
      timestamp: '1557058490'
    },
    sessionId: {
      name: 'session_id',
      value: '2019-05-05|14|140.128.66.101|mozilla'
    }
  }
];

describe('session-id', () => {
  it('should create session IDs', async () => {
    for (const { fields, ec, sessionId } of tests) {
      const process = await contextify(mw, ctx => {
        if (fields) {
          ctx.request.headers['session-id-fields'] = fields;
        }
      });
      await new Promise(resolve => process(ec, resolve));

      expect(ec).to.have.property(sessionId.name, sessionId.value);
    }
  });
});
