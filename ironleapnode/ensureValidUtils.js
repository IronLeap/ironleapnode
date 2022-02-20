
'use strict';

var isFunction = require('lodash/isFunction');
var isNumber = require('lodash/isNumber');
var isArray = require('lodash/isArray');

function ensureValidOptions(options) {
  if (!options) throw new Error('options are required');
  if (!options.appKey || typeof options.appKey !== 'string') {
    throw new Error(
      'An app key is required'
    );
  }
  if (options.identifyCompany && !isFunction(options.identifyCompany)) {
    throw new Error('identifyCompany should be a function');
  }
  if (options.getMetadata && !isFunction(options.getMetadata)) {
    throw new Error('getMetadata should be a function');
  }
  if (options.maskContent && !isFunction(options.maskContent)) {
    throw new Error('maskContent should be a function');
  }
  if (options.skip && !isFunction(options.skip)) {
    throw new Error('skip should be a function');
  }
  if (options.maxBatchSize && (!isNumber(options.maxBatchSize) || options.maxBatchSize <= 0)) {
    throw new Error('batchSize must be a number greater than 0');
  }
  if (options.maxSendInterval && (!isNumber(options.maxSendInterval) || options.maxSendInterval <= 0)) {
    throw new Error('batchSendInterval must be a positive number of milliseconds');
  }
  if (options.requestMaxBodySize && (!isNumber(options.requestMaxBodySize) || options.requestMaxBodySize <= 0)) {
    throw new Error('requestMaxBodySize must be a number greater than 0');
  }
  if (options.responseMaxBodySize && (!isNumber(options.responseMaxBodySize) || options.responseMaxBodySize <= 0)) {
    throw new Error('responseMaxBodySize must be a number greater than 0');
  }
  if (options.requestMaskHeaders && !isArray(options.requestMaskHeaders)) {
    throw new Error('requestMaskHeaders must be an array');
  }
  if (options.responseMaskHeaders && !isArray(options.responseMaskHeaders)) {
    throw new Error('responseMaskHeaders must be an array');
  }
}

module.exports = {
  ensureValidOptions: ensureValidOptions,
};