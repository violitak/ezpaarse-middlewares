'use strict';

// Axios library used for API calls (requests is deprecated)
const axios = require('axios');
const co = require('co');
const cache = ezpaarse.lib('cache')('ncbi');
const { bufferedProcess, wait } = require('../utils.js');

// Pubmed Ids contain only digits
const pubmedPattern = /^\d*$/i;
// Pubmed Central Ids start with PMC then have digits
const pmcPattern    = /^PMC(\d*)$/i;

/**
* Enrich ECs with NCBI data
*/
module.exports = function () {

  // Set references to this object
  const logger  = this.logger;
  const report  = this.report;
  const request = this.request;

  logger.verbose('Initializing NCBI enrichment');

  // Fetch cache status
  const cacheEnabled = !/^false$/i.test(request.header('ncbi-cache'));
  logger.verbose(`NCBI cache: ${cacheEnabled ? 'enabled' : 'disabled'}`);

  // Check cache connection
  if (!cache) {
    const err = new Error('Failed to connect to mongodb, cache not available for NCBI');
    err.status = 500;
    return err;
  }

  // Add additional title column to the EC output
  if (this.job.outputFields.added.indexOf('title') === -1) {
    this.job.outputFields.added.push('title');
  }

  // Time-to-live of cached documents
  let ttl = parseInt(request.header('ncbi-ttl')) || 3600 * 24 * 7;

  const apikey = request.header('ncbi-apikey') || undefined;
  // Minimum wait time before each request (in ms)
  let throttle = parseInt(request.header('ncbi-throttle')) || apikey ? 100 : 500;
  // Maximum number of NCBI ids to query
  let packetSize = parseInt(request.header('ncbi-packet-size')) || 200;
  // Minimum number of ECs to keep before resolving them
  let bufferSize = parseInt(request.header('ncbi-buffer-size') || 1000);
  // Maximum enrichment attempts
  let maxTries = parseInt(request.header('ncbi-max-tries')) || 5;
  // Email associated with account for API calls
  const email = ezpaarse.config.EZPAARSE_ADMIN_MAIL || request.header('ncbi-email') || 'YOUR_EMAIL';
  // Tool associated with account for API calls
  const tool = request.header('ncbi-tool') || 'ezPAARSE (https://ezpaarse.org; mailto:ezteam@couperin.org)';
  // Time-to-live of cached documents


  // Initialize output reports
  report.set('ncbi', 'ncbi-queries', 0);
  report.set('ncbi', 'ncbi-count', 0);
  report.set('ncbi', 'ncbi-query-fails', 0);
  report.set('ncbi', 'ncbi-cache-fails', 0);

  const process = bufferedProcess(this, {
    packetSize,
    bufferSize,
    /**
    * Filter ECs that should be enriched
    * @param {Object} ec
    * @returns {Boolean|Promise} true if the EC should be enriched, false otherwise
    */
    filter: ec => {
      // Must have a unit id defined
      if (!ec.unitid) { return false; }
      // Must have the ncbi platform
      if (ec.platform !== 'ncbi') { return false; }

      // Unit id must have the format needed for Pubmed or Pubmed Central
      if (!pubmedPattern.test(ec.unitid) && !pmcPattern.test(ec.unitid)) { return false; }
      // If the cache is not enabled, make a query
      if (!cacheEnabled) { return true; }

      // Search the cache for the unit id
      return findInCache(ec.unitid).then(cachedDoc => {
        if (cachedDoc) {
          enrichEc(ec, cachedDoc);
          return false;
        }
        return true;
      });
    },
    onPacket: co.wrap(onPacket)
  });

  return new Promise(function (resolve, reject) {
    // Verify cache indices and time-to-live before starting
    cache.checkIndexes(ttl, function (err) {
      if (err) {
        logger.error(`NCBI: failed to verify indexes : ${err}`);
        return reject(new Error('Failed to verify indexes for the cache of NCBI'));
      }
      // Run the process on every EC
      resolve(process);
    });
  });

  /**
  * Process a packet of ECs
  * @param {Array<Object>} ecs
  * @param {Map<String, Array<Object>>} groups ECs grouped
  */
  function* onPacket({ ecs }) {
    // Group the ECs by the database they refer to.
    const groupedECs = new Map();
    groupedECs.set('pubmed', new Set());
    groupedECs.set('pmc', new Set());

    // Get the list of databases
    const dbs = Array.from(groupedECs.keys());

    // Place each EC into one of the database lists depending on the pattern.
    for (const [ec, done] of ecs) {
      if (pubmedPattern.test(ec.unitid)) {
        groupedECs.get('pubmed').add(ec.unitid);
      }
      else if (pmcPattern.test(ec.unitid)) {
        // Pull just the number from the PMC id
        let match = ec.unitid.match(pmcPattern);
        groupedECs.get('pmc').add(match[1]);
      }
    };

    // Create a combined look up list
    let docs = [];
    // Query each database separately
    for (const db of dbs) {
      // Skip any database that doesn't have ids to look for.
      if (groupedECs.get(db).size === 0) continue;

      let tries = 0;
      let dbdocs;

      while (!dbdocs) {
        // See if the maximum tries have been reached
        if (++tries > maxTries) {
          const err = new Error(`Failed to query NCBI API ${maxTries} times in a row`);
          return Promise.reject(err);
        }

        // Try to yield the documents
        try {
          // Query the database
          dbdocs = yield query(db, groupedECs.get(db));
        }
        catch (err) {
          logger.error(`NCBI: ${err.message}`);
        }
      }

      // Add the documents to the list of all documents
      // Loop through all the unitids and extract information from the data result
      // Pass only pertinent information to docs
      dbdocs.uids.forEach(uid => docs.push(processDocument(db, uid, dbdocs)));

      yield wait(throttle);
    }

    // Initialize an empty map to contain results of query
    const results = new Map();
    // Index results by ID for faster searching
    // Cache the documents for later use
    for (const doc of docs) {
      results.set(doc.unitid, doc);
      // Cache the document
      try {
        yield cacheResult(doc.unitid, doc);
      }
      catch (err) {
        report.inc('ncbi', 'ncbi-cache-fails');
      }
    }

    // Loop through all the ECs and enrich them
    for (const [ec, done] of ecs) {
      const id = ec.unitid;
      // Enrich the EC
      if (results.has(id)) {
        enrichEc(ec, results.get(id));
        report.inc('ncbi', 'ncbi-count');
      }
      else {
        try {
          // If we can't find a result for a given ID, we cache an empty document
          yield cacheResult(id, {});
        }
        catch (err) {
          report.inc('ncbi', 'ncbi-cache-fails');
        }
      }
      done();
    }
  }

  /**
  * Reprocess the documents
  * @param  {Object}   db     The database queried for this document
  * @param  {Object}   unitid The item id for this document
  * @param  {Object}   data   The response document from the api call
  */
  function processDocument(db, unitid, data) {
    // Initialize the document to cache
    let doc = {};

    // Fill document values
    // Need to reinsert the PMC preface for the unit id
    // Store empty strings if values are not found
    doc.unitid = (db === 'pmc') ? 'PMC' + unitid :  unitid;
    doc.issn = data[unitid].issn || '';
    doc.essn = data[unitid].essn || '';
    doc.fulljournalname = data[unitid].fulljournalname || '';
    doc.shortjournalname = data[unitid].source || '';
    doc.volume = data[unitid].volume || '';
    doc.issue = data[unitid].issue || '';
    doc.pages = data[unitid].pages || '';
    doc.title = data[unitid].title || '';

    // Pull the DOI, if available from the list of article ids
    let articleid = data[unitid].articleids.find(aid => aid.idtype === 'doi');

    // new
    if (articleid && articleid.value) {
      doc.doi = articleid.value;
    }

    return doc;
  }

  /**
  * Query NCBI and process results
  * @param  {Object}   database The NCBI database to query
  * @param  {Object}   ids   List of item ids to query
  * @param  {Function} callback(err, result)
  */
  function query(database, ids) {

    // Record query attempt
    report.inc('ncbi', 'ncbi-queries');

    // The base URL for the eutils
    const baseURL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

    // Parameters to pass to the eutils
    let params = {
      db: database,
      version: '2.0',
      retmode: 'json',
      id: Array.from(ids).join(','),
      email: email,
      tool: tool
    };
    if (apikey) { params.api_key = apikey }
    return new Promise ((resolve, reject) => {
      // Query the NCBI eutils
      axios.get(baseURL, {params: params})
      .then(function (response) {
        if (response.status != 200) {
          report.inc('ncbi', 'ncbi-query-fails');
          return reject(new Error('Unexpected Status Code: ' + response.statusCode));
        }
        let data = response.data.result;

        // Return the list of documents
        return resolve(data);
      })
      .catch(error => {
        report.inc('ncbi', 'ncbi-query-fails');
        return reject(error)});
      });
    }

    /**
    * Enrich an EC using the result of a query
    * @param {Object} ec the EC to be enriched
    * @param {Object} result the document used to enrich the EC
    */
    function enrichEc(ec, result) {
      ec.print_identifier = result.issn;
      ec.online_identifier = result.essn;
      ec.publication_title = result.fulljournalname;
      ec.doi = result.doi;
      ec.title = result.title;
    }

    /**
    * Cache an item with a given ID
    * @param {String} id the ID of the item
    * @param {Object} item the item to cache
    */
    function cacheResult(id, item) {
      return new Promise((resolve, reject) => {
        if (!id || !item) { return resolve(); }

        // The entire object can be pretty big
        // We only cache what we need to limit memory usage
        const cached = {
          unitid: item.unitid,
          issn: item.issn,
          essn: item.essn,
          fulljournalname: item.fulljournalname,
          shortjournalname: item.source,
          volume: item.volume,
          issue: item.issue,
          pages: item.pages,
          doi: item.doi
        };

        cache.set(id, cached, (err, result) => {
          if (err) { return reject(err); }
          resolve(result);
        });
      });
    }

    /**
    * Find the item associated with a given ID in the cache
    * @param {String} identifier the ID to find in the cache
    */
    function findInCache(identifier) {
      return new Promise((resolve, reject) => {
        if (!identifier) { return resolve(); }

        cache.get(identifier, (err, cachedDoc) => {
          if (err) { return reject(err); }
          resolve(cachedDoc);
        });
      });
    }
  };
