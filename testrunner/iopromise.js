var iopromise = function () {
  var deferred = {
    promiseHandlers: {},
    promise:{
      on:function (type, callback) {
        if (!(type in deferred.promiseHandlers)){
          deferred.promiseHandlers[type] = [];
        }
        deferred.promiseHandlers[type].push(callback);
        return deferred.promise;
      }
    },
    signal: function (type) {
      if (deferred.promiseHandlers[type]) {
        var args = Array.prototype.slice.call(arguments, 0);
        args.splice(0,1);
        // call back each listener
        for (var i = 0; i < deferred.promiseHandlers[type].length; i++) {
          deferred.promiseHandlers[type][i].apply(this, args);
        };
      }
    }
  }

  return deferred;
};

exports.iopromise = iopromise;