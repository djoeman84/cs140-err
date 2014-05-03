var Firebase = require('firebase'),
  exec = require('child_process').exec;


var timeout = 1000*10;

var statsRef = new Firebase('https://cs140-2014.firebaseio.com/stats');

var makeOutRef = new Firebase('https://cs140-2014.firebaseio.com/make/out');
var makeErrRef = new Firebase('https://cs140-2014.firebaseio.com/make/err');
var makeCheckOutRef = new Firebase('https://cs140-2014.firebaseio.com/make_check/out');
var makeCheckErrRef = new Firebase('https://cs140-2014.firebaseio.com/make_check/err');

var passRef = new Firebase('https://cs140-2014.firebaseio.com/make_check/pass');
var failRef = new Firebase('https://cs140-2014.firebaseio.com/make_check/fail');


function make () {

  var child = exec('cd ~/CS140/pintos/src/userprog && make clean && make', 
    function (error, stdout, stderr) {
      var stdout_split = stdout.split('\n');
      var stderr_split = stderr.split('\n');

      makeOutRef.set(stdout_split);
      makeErrRef.set(stderr_split);

      // stats 
      statsRef.child('makeOut')
        .set(stdout_split.length);
      statsRef.child('makeErr')
        .set(stderr_split.length);

      statsRef.child('makeTime')
        .set(Firebase.ServerValue.TIMESTAMP);

      console.log('make complete');
      make_check();
    }
  );
}


function make_check () {  

  var child = exec('cd ~/CS140/pintos/src/userprog/build && make check', 
    function (error, stdout, stderr) {

      passRef.set([]);
      failRef.set([]);

      var passNum = 0;
      var failNum = 0;

      var stdout_split = stdout.split('\n');
      var stderr_split = stderr.split('\n');

      for (var i = 0; i < stdout_split.length; i++) {
        var line = stdout_split[i];
        if (line.match(/^FAIL/))  {
          failRef.push(line);
          failNum++;
        } else if (line.match(/^PASS/)) {
          passRef.push(line);
          passNum++;
        }
      };
      makeCheckOutRef.set(stdout_split);
      makeCheckErrRef.set(stderr_split);

      // stats
      statsRef.child('pass')
        .set(passNum);
      statsRef.child('fail')
        .set(failNum);

      statsRef.child('makeCheckOut')
        .set(stdout_split.length);
      statsRef.child('makeCheckErr')
        .set(stderr_split.length);

      statsRef.child('makeCheckTime')
        .set(Firebase.ServerValue.TIMESTAMP);

      console.log('make_check complete');
      setTimeout(function () {
        make();
      }, timeout);
    }
  );

}

make();