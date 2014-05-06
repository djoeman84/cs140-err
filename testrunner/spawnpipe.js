var spawn = require('child_process').spawn,
  es = require('event-stream'),
  iopromise = require('./iopromise').iopromise;

function spawnpipe (exec, args, options) {
  var deferred = iopromise();

  var child = spawn(exec, args, options);
  child.stdin.setEncoding = 'utf-8';

  setTimeout(function () {
    deferred.signal('create',child);
  },1);

  var stream = es.pipeline(
    child.stdout,
    es.split(),
    es.map(function (line) {
      deferred.signal('stdout',line);
    })
  );


  es.pipeline(
    child.stderr,
    es.split(),
    es.map(function (line) {
      deferred.signal('stderr',line);
    })
  );

  child.on('close', function () {
    deferred.signal('close', child);
  });

  child.on('error', function () {
    deferred.signal('error');
  })

  return deferred.promise;
};




exports.spawnpipe = spawnpipe;