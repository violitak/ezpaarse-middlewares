'use strict';

const fs = require('fs');
const path = require('path');

module.exports = function () {
  const req = this.request;
  const logger = this.logger;

  let sourceField = req.header('idp-to-institution-source-field');
  let filenameField = req.header('idp-to-institution-filename');
  let institutionNameEnrichedField = req.header('idp-to-institution-institution-name-enriched-field');
  let idCouperinEnrichedField = req.header('idp-to-institution-id-couperin-enriched-field');

  if (!sourceField) { sourceField = 'login'; }
  if (!filenameField) { filenameField = 'ListeIdpIdc.json'; }
  if (!institutionNameEnrichedField) { institutionNameEnrichedField = 'institutionName'; }
  if (!idCouperinEnrichedField) { idCouperinEnrichedField = 'idCouperin'; }

  this.job.outputFields.added.push(institutionNameEnrichedField);
  this.job.outputFields.added.push(idCouperinEnrichedField);

  let idp;

  return new Promise((resolve, reject) => {
    if (!/^[a-zA-Z0-9_.-]+$/.test(filenameField)) {
      reject(new Error(`Invalid filename: ${filenameField}`));
      return;
    }

    const filePath = path.resolve(__dirname, filenameField);

    if (!fs.existsSync(filePath)) {
      logger.error('[idp-to-institution]: File not found');
      reject(new Error(`File not found: ${filenameField}`));
      return;
    }

    fs.readFile(filePath, 'utf-8', (err, data) => {
      if (err) {
        logger.error('[idp-to-institution]: Cannot read file');
        reject(err);
        return;
      }

      try {
        const parsedData = JSON.parse(data);
        idp = parsedData.reduce((acc, objet) => acc.set(objet.idp, objet), new Map());
        logger.info('[idp-to-institution]: Successfully read JSON File');
        resolve(process);
      } catch (error) {
        logger.error('[idp-to-institution]: Cannot parse ips');
        reject(error);
      }
    });
  });

  function process(ec, next) {
    if (!ec || !ec[sourceField]) { return next(); }

    const entry = idp.get(ec[sourceField]);

    if (entry) {
      if (!ec[institutionNameEnrichedField]) {
        ec[institutionNameEnrichedField] = entry.nomCouperin;
      }
      if (!ec[idCouperinEnrichedField]) {
        ec[idCouperinEnrichedField] = entry.idCouperin;
      }
    }


    next();
  }

};