var sjcl = require('sjcl');

exports.helpers = {
  
  isFailLine: function (line) {
    return line.match(/^FAIL\s[^\s]+$/);
  },

  getFailName: function (line) {
    var match = line.match(/^FAIL\s.*\/([^\/\s]+)$/);
    return (match && match.length > 1) ? match[1] : null;
  },

  isPassLine: function (line) {
    return line.match(/^pass\s[^\s]+$/);
  },

  getPassName: function (line) {
    var match = line.match(/^pass\s.*\/([^\/\s]+)$/);
    return (match && match.length > 1) ? match[1] : null;
  },

  set: function () {
    this.elems = {};
    this.add = function (key, val) {
      this.elems[key] = val || true;
    };
    this.contains = function (key) {
      return !!this.elems[key];
    };
    this.remove = function (key) {
      if (this.contains(key)) {
        delete this.elems[key];
      }
    };
    this.clear = function () {
      this.elems = {};
    };
    this.tryAdd = function (key) {
      var isNew = !this.contains(key);
      if (isNew) {
        this.add(key);
      }
      return isNew;
    };
    this.each = function (callback) {
      for (var key in this.elems) {
        callback(key, this.elems[key]);
      }
    };
  },

  dataRefDecode: function (dataRef) {
    return dataRef;
  }

};