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


function run () {
  check_branch_name();
}


function check_branch_name () {
  var child = exec('cd ~/CS140/pintos && git status', 
    function (error, stdout, stderr) {
      var branch_name = stdout.match(/On branch ([a-zA-Z0-9_\-]+)/)[1];

      // stats 
      statsRef.child('branchName')
        .set(branch_name);

      console.log('branch name checked');

      upload_git_log();
    }
  );
}

function upload_git_log () {
  var child = exec('cd ~/CS140/pintos && git log', 
    function (error, stdout, stderr) {

      // stats 
      statsRef.child('gitLog')
        .set(stdout.split('\n'));

      console.log('branch log uploaded');

      make();
    }
  );
};

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

  var passed_failed = {};

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
          if (!(line in passed_failed)) {
            failRef.push(line);
            failNum++;
            passed_failed[line] = true;
          }
        } else if (line.match(/^pass/)) {
          if (!(line in passed_failed)) {
            passRef.push(line);
            passNum++;
            passed_failed[line] = true;
          }
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
        run();
      }, timeout);
    }
  );

}


run();
