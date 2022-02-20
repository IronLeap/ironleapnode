'use strict';

var dataUtils = require('./dataUtils');

var logMessage = dataUtils.logMessage;
var bodyToBase64 = dataUtils.bodyToBase64;
var startWithJson = dataUtils.startWithJson;
var safeJsonParse = dataUtils.safeJsonParse;
var isJsonHeader = dataUtils.isJsonHeader;
var computeBodySize = dataUtils.computeBodySize;

function ensureToString(id) {
  if (typeof id === 'number') {
    return String(id);
  }
  if (typeof id === 'string') {
    return id;
  }
  if (id === null || id === undefined) {
    return id;
  }
  if (typeof id === 'object') {
    return String(id);
  }
  return id;
}


function decodeHeaders(header) {
  try {
    var keyVal = header.split('\r\n');

    // Remove Request Line or Status Line
    keyVal.shift();

    var obj = {};
    var i;
    for (i in keyVal) {
      keyVal[i] = keyVal[i].split(':', 2);
      if (keyVal[i].length != 2) {
        continue;
      }
      obj[keyVal[i][0].trim()] = keyVal[i][1].trim();
    }
    return obj;
  } catch (err) {
    return {};
  }
}

function safeGetResponseHeaders(res) {
  try {
    if (res.getHeaders) {
      return res.getHeaders();
    }
    try {
      // access ._headers will result in exception
      // in some versions fo node.
      // so must be in try block.
      if (res._headers) {
        return res._headers;
      }
    } catch (err) {
    }
    return res.headers || decodeHeaders(res._header);
  } catch(err) {
    return {};
  }
}

// req getters that require trust proxy fn
// protocol (not used).
// ips (not used)
// ip (not used)
// subdomains (not used)
// hostname
// secure (used)

function safeGetHostname(req) {
  try {
    return req.hostname;
  } catch(err) {
    return (req.headers && req.headers['x-forwarded-host']) || 'localhost';
  }
}

function safeGetReqSecure(req) {
  try {
    return req.secure;
  } catch(err) {
    return false;
  }
}

function maskHeaders(headers, headersToMask) {
  if (!headersToMask) {
    return headers
  }

  var processedHeaders = {}
  for (var key in headers) {
    processedHeaders[key] = headers[key]
  }

  headersToMask.forEach((mask) => {
    var key = mask.toLowerCase();
    if (processedHeaders.hasOwnProperty(key)) {
      delete processedHeaders[key]
    }
  })
  return processedHeaders
}

function formatAndSaveEvent(responseBodyBuffer, req, res, options, saveEvent) {
  var logData = {};

  logData.request = {};
  logData.request.time = req._startTime;
  logData.request.verb = req.method;
  var protocol =
    (req.connection && req.connection.encrypted) || safeGetReqSecure(req) ? 'https://' : 'http://';
  var host = req.headers.host || safeGetHostname(req);
  logData.request.uri = protocol + host + (req.originalUrl || req.url);
  logData.request.headers = req.headers;
  if (options.logBody) {
    const requestBody = req.body || req._il_raw_body;
    const requestBodySize = computeBodySize(requestBody);
    if (requestBodySize > options.requestMaxBodySize) {
      logData.request.body = {
        msg: 'request.body.length exceeded options requestMaxBodySize of ' + options.requestMaxBodySize
      }
      logData.request.transfer_encoding = 'json'
    } else if (requestBody) {
      var isReqBodyMaybeJson = isJsonHeader(req) || startWithJson(requestBody);

      if (isReqBodyMaybeJson) {
        var parsedReqBody = safeJsonParse(requestBody);
        logData.request.transfer_encoding = parsedReqBody.transferEncoding;
        logData.request.body = parsedReqBody.body;
      } else {
        logData.request.transfer_encoding = 'base64';
        logData.request.body = bodyToBase64(requestBody);
      }
    }
  }

  logData.response = {};
  logData.response.time = res._endTime;
  logData.response.status = res.statusCode ? res.statusCode : 599;
  res._ilHeaders = safeGetResponseHeaders(res);
  logData.response.headers = res._ilHeaders;
  if (options.logBody && responseBodyBuffer) {
    if (responseBodyBuffer.length < options.responseMaxBodySize) {
        if (isJsonHeader(res) || startWithJson(responseBodyBuffer)) {
            var parsedResBody = safeJsonParse(responseBodyBuffer);
            logData.response.transfer_encoding = parsedResBody.transferEncoding;
            logData.response.body = parsedResBody.body;
        } else {
            logData.response.transfer_encoding = 'base64';
            logData.response.body = bodyToBase64(responseBodyBuffer);
        }
    } else {
        logData.response.body = {
          msg: 'response.body.length exceeded options responseMaxBodySize of ' + options.responseMaxBodySize
        }
        logData.response.transfer_encoding = 'json'
    }
  }

  logData.company_id = ensureToString(options.identifyCompany(req, res));
  logData.metadata = options.getMetadata(req, res);

  logData.request.headers = maskHeaders(logData.request.headers, options.requestMaskHeaders)
  logData.response.headers = maskHeaders(logData.response.headers, options.responseMaskHeaders)
  logData = options.maskContent(logData);

  // This is fire and forget, we don't want logging to hold up the request so don't wait for the callback
  if (!options.skip(req, res)) {
    logMessage(options.debug, 'saving event');
    saveEvent(logData);
  }
}

module.exports = formatAndSaveEvent;
