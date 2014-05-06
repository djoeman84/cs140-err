var testrunner = require('./testrunner/testrunner'),
  ArgumentParser = require('argparse').ArgumentParser;


var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp:true,
  description: 'CS140 Test Runner'
});


parser.addArgument(
  [ '-c', '--continuous' ],
  {
    help: 'run continuously',
    nargs:0
  }
);

parser.addArgument(
  [ '-l', '--log' ],
  {
    help: 'log all of stdin and stdout',
    nargs:0
  }
);

parser.addArgument(
  [ '-w', '--watch' ],
  {
    help: 'watch for file change',
    nargs:0
  }
);



var args = parser.parseArgs();

testrunner.run(args);