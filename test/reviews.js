var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var TEST_FILES = 'test/files';
var TEST_TEMPLATES = 'test/templates';

var config = require('../config.json');
var Reviews;

describe('Reviews', function () {
	it('setup', function (done) {
		config.reviews.path = TEST_FILES;
		fs.unlink(path.join(TEST_FILES, config.reviews.database), function () {
			var templateFile = fs.createReadStream(path.join(TEST_TEMPLATES, config.reviews.database));
			
			templateFile.pipe(fs.createWriteStream(path.join(TEST_FILES, config.reviews.database)));
			templateFile.on('end', done);
		});
	});
	
	it('should exist', function () {
		Reviews = require('../reviews.js');
		expect(Reviews).to.be.ok;
	});
	
	describe('#getReviewsIncludingReviewer', function () {
		it('should return the correct set of reviews', function (done) {
			Reviews.getReviewsIncludingReviewer('bob@foo.com').then(function (reviews) {
				expect(reviews).to.deep.equal([{
					"ix": 1,
					"title": "Test Review",
					"owner": "John Doe <john.doe@example.com>",
					"whenCreated": 1438456772247,
					"status": "active",
					"statusLabel": null
				}]);
				done();
			});
		});
	});
});