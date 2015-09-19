	
var fs = require('fs-extra');
var path = require('path');

var config = require('../config.json');

var TEST_TEMPLATES = 'test/templates';

module.exports = {
	setupTestFolder: function (testName, templatesToCopy) {
		var testDir = path.join('test', 'files', path.parse(testName).name);
		config.reviews.path = testDir;
		
		fs.emptyDirSync(testDir);
		if (templatesToCopy) {
			templatesToCopy.forEach(function (filename) {
				fs.copySync(path.join(TEST_TEMPLATES, filename), path.join(testDir, filename));
			});
		}
	}
};