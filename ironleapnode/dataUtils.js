'use strict';

var url = require('url');
var assign = require('lodash/assign');

var logMessage = function(debug, message) {
  if (debug) {
    console.log('IRON LEAP: ' + message);
  }
};

function appendChunk(buf, chunk) {
    if (chunk) {
      if (Buffer.isBuffer(chunk)) {
        return buf ? Buffer.concat([buf, chunk]) : Buffer.from(chunk);
      } else if (typeof chunk === 'string') {
        return buf ? Buffer.concat([buf, Buffer.from(chunk)]) : Buffer.from(chunk);
      } else if (typeof chunk === 'object' || Array.isArray(chunk)) {
        try {
          return buf
            ? Buffer.concat([buf, Buffer.from(JSON.stringify(chunk))])
            : Buffer.from(JSON.stringify(chunk));
        } catch (err) {
          return buf;
        }
      } else {
        console.error('Response body chunk is not a Buffer or String.');
      }
    }
}
  
function totalChunkLength(chunk1, chunk2) {
    var length1 = chunk1 ? chunk1.length || 0 : 0;
    var length2 = chunk2 ? chunk2.length || 0 : 0;
    return length1 + length2;
}

function approximateObjectSize(obj) {
    var objectList = [];
    var stack = [obj];
    var bytes = 0;
    while (stack.length) {
      var value = stack.pop();
      if (typeof value === 'boolean') {
        bytes += 4;
      } else if (typeof value === 'string') {
        bytes += value.length * 2;
      } else if (typeof value === 'number') {
        bytes += 8;
      } else if (typeof value === 'object' && objectList.indexOf(value) === -1) {
        objectList.push(value);
        for (var i in value) {
          stack.push(value[i]);
        }
      }
    }
    return bytes;
}

function computeBodySize(body) {
    if (body === null || body === undefined) {
      return 0;
    }
    if (typeof body === 'string') {
      return body.length;
    }
    if (typeof body === 'object') {
      return approximateObjectSize(body);
    }

    return 0;
}


function _bodyToBase64(body) {
    if (!body) {
      return body;
    }
    if (Buffer.isBuffer(body)) {
      return body.toString('base64');
    } else if (typeof body === 'string') {
      return Buffer.from(body).toString('base64');
    } else if (typeof body.toString === 'function') {
      return Buffer.from(body.toString()).toString('base64');
    } else {
      return '';
    }
}
  
function _safeJsonParse(body) {
    try {
      if (!Buffer.isBuffer(body) &&
        (typeof body === 'object' || Array.isArray(body))) {
        return {
          body: body,
          transferEncoding: 'json'
        }
      }
      return {
        body: JSON.parse(body.toString()),
        transferEncoding: 'json'
      }
    } catch (e) {
      return {
        body: _bodyToBase64(body),
        transferEncoding: 'base64'
      }
    }
}
  
function _startWithJson(body) {
    var str;
    if (body && Buffer.isBuffer(body)) {
      str = body.slice(0, 1).toString('ascii');
    } else {
      str = body;
    }

    if (str && typeof str === 'string') {
      var newStr = str.trim();
      if (newStr.startsWith('{') || newStr.startsWith('[')) {
        return true;
      }
    }
    return false;
}
  
function isJsonHeader(msg) {
    if (msg) {
      var headers = msg.headers || msg._ilHeaders;
      if (headers['content-encoding']) {
        return false;
      }
      if (headers['content-type'] && headers['content-type'].indexOf('json') >= 0) {
        return true;
      }
    }
    return false;
}


module.exports = {
    logMessage: logMessage,
    appendChunk: appendChunk,
    totalChunkLength: totalChunkLength,
    computeBodySize: computeBodySize,
    bodyToBase64: _bodyToBase64,
    safeJsonParse: _safeJsonParse,
    startWithJson: _startWithJson,
    isJsonHeader: isJsonHeader, 
};
  
  