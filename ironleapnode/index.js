'use strict';

var dataUtils = require('./dataUtils');
var createBatcher = require('./batcher');
var ensureValidUtils = require('./ensureValidUtils');
var formatAndSaveEvent = require('./formatAndSaveEvent');
var ApiClient = require('./apiclient');


var logMessage = dataUtils.logMessage;
var appendChunk = dataUtils.appendChunk;
var totalChunkLength = dataUtils.totalChunkLength;

var ensureValidOptions = ensureValidUtils.ensureValidOptions;

var noop = function () {}; // implicitly return undefined

var defaultSkip = function(req, res) {
  return false;
};

//
// ### function ironleapnode(options)
// #### @options {Object} options to initialize the middleware.
//
module.exports = function(options) {
  logMessage(options.debug, 'starting');
  ensureValidOptions(options);

  options.identifyCompany = options.identifyCompany || noop;
  options.getMetadata = options.getMetadata || noop;
  var logBody = true;
  if (typeof options.logBody !== 'undefined' && options.logBody !== null){
    logBody = Boolean(options.logBody);
  }
  options.logBody = logBody;
  options.maskContent = options.maskContent || function(eventData) { return eventData;};
  options.skip = options.skip || defaultSkip;

  options.maxBatchSize = options.maxBatchSize || 25;
  options.maxSendInterval = options.maxSendInterval || 2000;
  options.requestMaxBodySize = options.requestMaxBodySize || 100000;
  options.responseMaxBodySize = options.responseMaxBodySize || 100000;

  var client = new ApiClient(options.appKey, options.ironleapUrl)

  var batcher = createBatcher(
    function(eventArray) {
      try {
        client.postEventsBatch(eventArray, options)
      } catch(err) {
        logMessage(options.debug, 'error occurred during send batch: ' + err);
      }
    },
    options.maxBatchSize,
    options.maxSendInterval,
  );

  var saveEvent = function(eventData) {
    logMessage(options.debug, 'saving event');
    batcher.add(eventData);
  };

  const ironLeapMiddleware = function(arg1, arg2, arg3) {
    var req = arg1;
    var res = arg2;
    var next = arg3;
    req._startTime = new Date();

    logMessage(options.debug, 'starting ironleap middleware');

    if (options.skip(req, res)) {
      logMessage(options.debug, 'skipping ' + req.originalUrl);
      if (next) {
        return next();
      }
    }

    // declare getRawBodyPromise here so in scope.
    var getRawBodyPromise;
    var rawReqDataFromEventEmitter;
    var dataEventTracked = false;

    if (
      options.logBody &&
      !req.body &&
      req.headers &&
      req.headers['content-type'] &&
      req.headers['content-length'] &&
      parseInt(req.headers['content-length']) > 0
    ) {
      // this will attempt to capture body in case body parser or some other body reader is used.
      // by instrumenting the "data" event.
      // notes: in its source code: readable stream pipe (incase of proxy) will also trigger "data" event
      req._il_prev_on = req.on;
      req.on = function(evt, handler) {
        var updatedHandler = handler;
        if (evt === 'data' && !dataEventTracked) {
          logMessage(options.debug, 'patching data event');
          dataEventTracked = true;
          updatedHandler = function(chs) {
            if (totalChunkLength(rawReqDataFromEventEmitter, chs)  < options.requestMaxBodySize) {
              rawReqDataFromEventEmitter = appendChunk(rawReqDataFromEventEmitter, chs);
            } else {
              rawReqDataFromEventEmitter = '{ "msg": "request body size exceeded options requestMaxBodySize" }';
            }
            handler(chs);
          }
        }
        return req._il_prev_on(evt, updatedHandler);
      }

      // this is used if no one ever ever read request data after response ended already.
      getRawBodyPromise = function() {
        return new Promise(function(resolve, reject) {
          logMessage(options.debug, "getRawBodyPromise executor started");
          var total;
          if (!req.readable) {
            resolve(total);
          }
          req._il_prev_on('data', function (chs) {
            if (totalChunkLength(total, chs) < options.requestMaxBodySize) {
              total = appendChunk(total, chs);
            } else {
              total =
                '{ "msg": "request body size exceeded options requestMaxBodySize" }';
            }
          });
          req._il_prev_on('error', function(err) {
            logMessage(options.debug, "getRawBodyPromise executor error reading request body");
            resolve('{ "msg": "error reading request body"}');
          });
          req._il_prev_on('end', function() {
            resolve(total);
          });
          // a fail safe to always exit
          setTimeout(function() {
            resolve(total);
          }, 1000);
        });
      };
    }

    // Manage to get information from the response too:
    res._il_prev_write = res.write;
    var resBodyBuf;
    var resBodyBufLimitedExceeded;

    if (options.logBody) {
      res.write = function(chunk, encoding, callback) {
        if (!resBodyBufLimitedExceeded && totalChunkLength(resBodyBuf, chunk) < options.responseMaxBodySize) {
          resBodyBuf = appendChunk(resBodyBuf, chunk);
        } else {
          resBodyBufLimitedExceeded = true;
        }
        res._il_prev_write(chunk, encoding, callback);
      };
    }

    res._il_prev_end = res.end;
    res.end = function(chunk, encoding, callback) {
      var finalBuf = resBodyBuf;

      if (chunk && typeof chunk !== 'function' && options.logBody) {
        if (!resBodyBufLimitedExceeded && totalChunkLength(resBodyBuf, chunk) < options.responseMaxBodySize) {
          finalBuf = appendChunk(resBodyBuf, chunk);
        } else {
          finalBuf = '{ "msg": "response.body.length exceeded options responseMaxBodySize of "}';
        }
      }

      res._il_prev_end(chunk, encoding, callback);

      res._endTime = new Date();
  
      try {
        if (!req.body && rawReqDataFromEventEmitter && options.logBody) {
          req._il_raw_body = rawReqDataFromEventEmitter;
        }
        // if req body or rawReqBody still don't exist, we can getRawBodyPromise.
        if (!req.body && !req._il_raw_body && getRawBodyPromise && options.logBody) {
          // at this point, the response already ended.
          // if no one read the request body, we can consume the stream.
          getRawBodyPromise()
            .then((str) => {
              req._il_raw_body = str;
              return req;
            })
            .then(() => {
              formatAndSaveEvent(finalBuf, req, res, options, saveEvent);
            })
            .catch((err) => {
              logMessage(options.debug, 'getRawBodyPromise error getting rawbody' + err);
            });
        } else {
          // this covers three use cases:
          // case 1: options.logBody is false. request body doesn't matter.
          // case 2: request.body is already attached to req.body
          // case 3: request.body doesn't exist anyways.
          formatAndSaveEvent(finalBuf, req, res, options, saveEvent);
        }
      } catch (err) {
        logMessage(options.debug, 'error occurred during log event: ' + err);
      }
    };

    if (next) {
      return next();
    }
  };

  return ironLeapMiddleware;
};
