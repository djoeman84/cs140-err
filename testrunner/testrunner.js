var Firebase = require('firebase'),
  spawnpipe  = require('./spawnpipe').spawnpipe,
  path       = require('path'),
  settings   = require('../runner-config.json'),
  helpers    = require('./helpers').helpers;




var run_tests = function (args) {
  settings.args = args;

  var childProcesses = new helpers.set();

  var dataRef = new Firebase(settings.firebaseUrl).child('data').child(helpers.dataRefDecode(settings.dataRef));

  var statsRef        = dataRef.child('stats');
  var makeOutRef      = dataRef.child('make').child('out');
  var makeErrRef      = dataRef.child('make').child('err');
  var makeCheckErrRef = dataRef.child('make_check').child('err');
  var testRef         = dataRef.child('tests');

  var makeDir = path.resolve(process.cwd(), settings.makeDir);
  var buildDir = path.resolve(process.cwd(), settings.buildDir);


  var VERBOSE = 1<<0;
  var LOG     = 1<<1;
  var ERROR   = 1<<2;

  var log_level = LOG;
  if (settings.args.log) {
    log_level |= VERBOSE;
  }

  function log (priority, message) {
    if (priority & log_level) {
      console.log(message);
    }
  };


  /* watch for file changes */
  if (settings.args.watch) {

    /* filter by file regex */
    function filter (pattern, fn) {
      return function(filename) {
        var reg = RegExp(pattern);
          if (reg.test(filename)) {
            fn(filename);
          }
        }
    }

    var watch = require('node-watch');
    watch(settings.watchDir, {recursive: settings.recursive, followSymLinks: settings.symLinks}, 
      filter(settings.filterBy, 
          function(filename) {

            /* kill all outstanding processes */
            childProcesses
              .each(function (pid, child) {
                child.kill()
              });
            childProcesses.clear();


            log(LOG, 'Updated ',filename);

            /* upload filename of file that caused update */
            statsRef.child('fileUpdated')
              .set({
                filename:filename,
                time:Firebase.ServerValue.TIMESTAMP
              });

            run();
          }
        )
      );
  }



  function run () {
    check_branch_name();
  }


  function check_branch_name () {

    /* spawn git status */
    spawnpipe('git',['status'])

      .on('create', function (child) {
        childProcesses.add(child.pid, child);
      })

      .on('stdout', function (line) {
        if (line && line.match(/On branch ([a-zA-Z0-9_\-]+)/)) {
          log(VERBOSE, line);
          var branch_name = line.match(/On branch ([a-zA-Z0-9_\-]+)/)[1];
          statsRef.child('branchName')
            .set(branch_name);
        }
      })

      .on('stderr', function (line) {
        if (line) {
          log(VERBOSE, line);
        }
      })

      .on('error', function () {
        log(ERROR, '====error=====');
      })

      .on('close', function (child) {
        log(LOG, 'branch name checked');
        childProcesses.remove(child.pid);
        upload_git_log();
      });

    
  }

  function upload_git_log () {

    statsRef.child('gitLog')
      .set({});

    /* spawn git log */
    spawnpipe('git',['log'])

      .on('create', function (child) {
        childProcesses.add(child.pid, child);
      })

      .on('stdout', function (line) {
        if (line) {
          log(VERBOSE, line);
          statsRef.child('gitLog').push(line);
        }
      })

      .on('stderr', function (line) {
        if (line) {
          log(VERBOSE, line);
        }
      })

      .on('error', function () {
        log(ERROR,'====error=====');
      })

      .on('close', function (child) {
        log(LOG,'branch log uploaded');
        childProcesses.remove(child.pid);
        make();
      });

  };

  function make () {

    var makeOutLen = 0;
    var makeErrLen = 0;

    makeOutRef.set({});
    makeErrRef.set({});
    statsRef.child('makeErr')
      .set(0);
    statsRef.child('makeOut')
      .set(0);

    _make_clean();

    

    function _make_clean () {

      /*  spawn make clean */
      spawnpipe('make',['clean'], {
        cwd:makeDir
      })

        .on('create', function (child) {
          childProcesses.add(child.pid, child);
        })

        .on('stdout', function (line) {
          if (line) {
            log(VERBOSE, line);
            makeOutRef.push(line);
            statsRef.child('makeOut')
              .set(++makeOutLen);
          }
        })

        .on('stderr', function (line) {
          if (line) {
            log(VERBOSE, line);
            makeErrRef.push(line);
            statsRef.child('makeErr')
              .set(++makeErrLen);
          }
        })

        .on('error', function () {
          log('====error=====');
        })

        .on('close', function (child) {
          log('make clean complete');
          childProcesses.remove(child.pid);
          _make();
        });

    }

    function _make () {

      /* spawn make */
      spawnpipe('make',[], {
        cwd:makeDir
      })
        .on('create', function (child) {
          childProcesses.add(child.pid, child);
        })

        .on('stdout', function (line) {
          if (line) {
            log(VERBOSE, line);
            if  (!line.match(/^gcc/)) {
              makeOutRef.push(line);
            }
            statsRef.child('makeOut')
              .set(++makeOutLen);
          }
        })

        .on('stderr', function (line) {
          if (line) {
            log(VERBOSE, line);
            makeErrRef.push(line);
            statsRef.child('makeErr')
              .set(++makeErrLen);
          }
        })

        .on('error', function () {
          log(ERROR,'====error=====');
        })

        .on('close', function (child) {
          statsRef.child('makeTime')
            .set(Firebase.ServerValue.TIMESTAMP);

          log(LOG,'make complete');
          childProcesses.remove(child.pid);
          make_check();
        });
    }
  }


  function make_check () {  

    var tests_seen = new helpers.set();
    var curr_test = undefined;

    testRef.set({});

    var passNum = 0;
    var failNum = 0;

    var makeCheckOutLen = 0;
    var makeCheckErrLen = 0;

    statsRef.child('fail')
      .set(0);
    statsRef.child('pass')
      .set(0);
    statsRef.child('makeCheckErr')
      .set(0);


    makeCheckErrRef.set({});


    spawnpipe('make',['check'], {
      cwd:buildDir
    })
      .on('create', function (child) {
        childProcesses.add(child.pid, child);
      })
      .on('stdout', function (line) {
        if (line) {

          log(VERBOSE, line);
          var sectionStartMatch = RegExp(settings.testCall);

          if (line.match(sectionStartMatch)) {

            if (curr_test) {
              testRef.push(curr_test);
            }

            curr_test = {lines:[]}
          }

          curr_test.lines.push(line);

          if (helpers.isFailLine(line) 
              && tests_seen.tryAdd(helpers.getFailName(line))) {

            curr_test.name = helpers.getFailName(line);
            curr_test.passed = false;

            statsRef.child('fail')
              .set(++failNum);
          }
          else if (helpers.isPassLine(line) 
              && tests_seen.tryAdd(helpers.getPassName(line))) {

            curr_test.name = helpers.getPassName(line);
            curr_test.passed = true;

            statsRef.child('pass')
              .set(++passNum);
          }

        }
      })
      .on('stderr', function (line) {
        if (line) {
          log(VERBOSE, line);
          makeCheckErrRef.push(line);
          statsRef.child('makeCheckErr')
            .set(++makeCheckErrLen);
        }
      })
      .on('error', function () {
        log(ERROR,'====error=====');
      })
      .on('close', function (child) {
        statsRef.child('makeCheckTime')
          .set(Firebase.ServerValue.TIMESTAMP);

        log(LOG,'make check complete');
        childProcesses.remove(child.pid);


        if (settings.args.continuous) {
          log(LOG, 'restarting');
          run();
        }

        if (!settings.args.continuous && !settings.args.watch) {
          process.exit(1);
        }
      });

  }

  run();
}

exports.run = run_tests;