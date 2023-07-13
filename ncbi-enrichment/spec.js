'use strict';

const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

const dataset = [
  {
    input: { platform: 'ncbi', unitid: 'PMC7584564' },
    expected: {
      "print_identifier": "",
      "online_identifier": "",
      "publication_title": /Biosensors & Bioelectronics/i,
      "doi": "10.1016/j.bios.2020.112752",
      "title": /COVID-19 diagnosis/i
    }
  },
  {
    input: { platform: 'ncbi', unitid: '33126180' },
    expected: {
      "print_identifier": "0956-5663",
      "online_identifier": "1873-4235",
      "publication_title": /Biosensors & bioelectronics/i,
      "doi": "10.1016/j.bios.2020.112752",
      "title": /COVID-19 diagnosis./i
    }
  },
  {
    input: { platform: 'ncbi', unitid: '29533942' },
    expected: {
      "print_identifier": "0304-324X",
      "online_identifier": "1423-0003",
      "publication_title": /Gerontology/i,
      "doi": "10.1159/000486592",
      "title": /Tooth Repair and Regeneration/i
    }
  },
  {
    input: { platform: 'ncbi', unitid: '34332395' },
    expected: {
      "print_identifier": "0958-2592",
      "online_identifier": "1532-2963",
      "publication_title": /Foot/i,
      "doi": "10.1016/j.foot.2021.101819",
      "title": /Lesser toe deformity/i
    }
  },
  {
    input: { platform: 'ncbi', unitid: '28661456' },
    expected: {
      "print_identifier": "",
      "online_identifier": "1422-0067",
      "publication_title": /molecular sciences/i,
      "doi": "10.3390/ijms18071398",
      "title": /Dry Eye Management/i
    }
  },
  {
    input: { platform: 'ncbi', unitid: 'PMC6494975' },
    expected: {
      "print_identifier": "",
      "online_identifier": "",
      "publication_title": /Lancet. Oncology/i,
      "doi": "10.1016/S1470-2045(18)30903-3",
      "title": /primary neoplasms/i
    }
  },
  {
    input: { platform: 'ncbi', unitid: 'PMC7336185' },
    expected: {
      "print_identifier": "",
      "online_identifier": "",
      "publication_title": /Burns & Trauma/i,
      "doi": "10.1093/burnst/tkaa017",
      "title": /diabetic foot disease/i
    }
  },
  {
    input: { platform: 'ncbi', unitid: 'PMC6889121' },
    expected: {
      "print_identifier": "",
      "online_identifier": "",
      "publication_title": /Otolaryngology/i,
      "doi": "10.1007/s10162-019-00735-1",
      "title": /Middle-Ear Pathology/i
    }
  },
  {
    input: { platform: 'ncbi', unitid: 'PMC9531090' },
    expected: {
      "print_identifier": "",
      "online_identifier": "",
      "publication_title": /Orthopaedic Surgery/i,
      "doi": "10.1111/os.13457",
      "title": /Modified Osteotomy/i
    }
  },
  {
    input: { platform: 'ncbi', unitid: 'PMC8662414' },
    expected: {
      "print_identifier": "",
      "online_identifier": "",
      "publication_title": /Sensors/i,
      "doi": "10.3390/s21238123",
      "title": /Electromagnetic Radiation/i
    }
  },
];

describe('ncbi-enrichment', function () {
  this.timeout(10000);

  it('should correctly return doi and journal information', async () => {
    const expected = new Map(dataset.map(({ input, expected }) => [input, expected]));
    const ecs = Array.from(expected.keys());
    let context;

    const process = await contextify(mw, ctx => {
      context = ctx;
      ctx.request.headers['ncbi-buffer-size'] = '5';
      ctx.request.headers['ncbi-packet-size'] = '5';
      ctx.request.headers['ncbi-cache'] = 'false';
    });

    await Promise.all(
      ecs.map((ec) => new Promise(resolve => process(ec, resolve)))
    );

    ecs.forEach((ec) => {
      Object.entries(expected.get(ec)).forEach(([fieldName, fieldValue]) =>{
        if (fieldValue instanceof RegExp) {
          expect(ec).to.have.property(fieldName).that.match(fieldValue);
        } else {
          expect(ec).to.have.property(fieldName).that.equals(fieldValue);
        }
      });
    });

    const report = context.report.getJson();
    expect(report).to.have.property('ncbi');
    expect(report.ncbi).to.have.property('ncbi-queries').that.is.a('number').below(4)
    expect(report.ncbi).to.have.property('ncbi-enriched-count', 10);
    expect(report.ncbi).to.have.property('ncbi-query-fails', 0);
  });
});
