'use strict';

const axios = require('axios');
var dataUtils = require('./dataUtils');
var logMessage = dataUtils.logMessage;

class ApiClient {
    constructor(appKey, uri) {
      this.appKey = appKey;
      this.uri = uri;
      this.headers = {
        'content-type' : 'application/json; charset=utf-8',
        'X-Ironleap-Application-ID': appKey,
      };
    }

    postEventsBatch(batch, options) {
      var data = JSON.stringify(batch)
      logMessage(options.debug, this.uri)
      logMessage(options.debug, data)
      axios.post(this.uri, data, {
        headers: this.headers,
      })
      .then(function (response) {
        logMessage(options.debug, "Successfully sent batch to Iron Leap")
      })
      .catch(function (error) {
        logMessage(options.debug, "Failed to send batch to Iron Leap")
        if (options.debug) {
            logMessage(options.debug, JSON.stringify(error.toJSON()))
        }       
      });    
    }
}

module.exports = ApiClient