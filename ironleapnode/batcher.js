'use strict';

function createBatcher(handleBatch, maxSize, maxTime) {
    return {
      dataArray: [],
      add: function(data) {
        this.dataArray.push(data);
        if (this.dataArray.length >= maxSize) {
          this.flush();
        } else if (maxTime && this.dataArray.length === 1) {
          var self = this;
          this._timeout = setTimeout(function() {
            self.flush();
          }, maxTime);
        }
      },
      flush: function() {
        clearTimeout(this._timeout);
        var currentDataArray = this.dataArray;
        this.dataArray = [];
        setTimeout(function() {
          handleBatch(currentDataArray);
        }, 10);
      }
    };
  }
  
  module.exports = createBatcher;
  