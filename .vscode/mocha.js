// Runner to invoke Mocha tests in the current process for easier debugging
'use strict';

var Mocha = require('mocha');
var glob = require('glob');

// Determine which tests to run based on argument passed to runner
var args = process.argv.splice(2);

//Define Mocha
var mocha = new Mocha({
	timeout: 10000,
	reporter: 'spec',
	globals: ['Associations', 'CREATE_TEST_WATERLINE', 'DELETE_TEST_WATERLINE']
});


function run(files) {
	files.forEach(mocha.addFile.bind(mocha));
	
	//Run unit tests
	mocha.run(function (failures) {
		console.log('press enter to exit...');
		process.stdin.resume();
		process.stdin.once('data', function () {
			process.exit(failures);			
		})
	});
}

if (!args.length) {
	glob('test/**/*.js', function (err, files) {
		run(files);
	});	
} else {
	run(args);
}