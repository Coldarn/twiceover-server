var chai = require('chai');
chai.use(require("chai-as-promised"));
var expect = chai.expect;
	
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
	
	it('module should initialize properly', function () {
		Reviews = require('../reviews.js');
		expect(Reviews).to.be.ok;
	});
	
	it('should queue and handle all requests in order', function () {
		var email = 'bonzai@foo.com';
		return expect(Promise.all([
			expect(Reviews.getReviewsIncludingReviewer(email)).to.eventually.have.length(0),
			Reviews.addReviewers(1, [email]),
			Reviews.addReviewers(2, [email]),
			expect(Reviews.getReviewsIncludingReviewer(email)).to.eventually.have.length(2),
			Reviews.addReviewers(3, [email]),
			expect(Reviews.getReviewsIncludingReviewer(email)).to.eventually.have.length(3),
			Reviews.addReviewers(4, [email]),
		])).to.be.fulfilled;
	});
	
	describe('getReviews tests', function () {
		it('#getReviewsIncludingReviewer before adding a reviewer', function () {
			return expect(Reviews.getReviewsIncludingReviewer('bob@foo.com'))
				.to.become([{
					"ix": 1,
					"title": "Test Review",
					"owner": "John Doe <john.doe@example.com>",
					"whenCreated": 1438456772247,
					"status": "active",
					"statusLabel": null
				}]);
		});
		it('#getReviewsExcludingReviewer before adding a reviewer', function () {
			return expect(Reviews.getReviewsExcludingReviewer('bob@foo.com'))
				.to.eventually.have.length(4);
		});
		
		it('add a reviewer', function () {
			return expect(Reviews.addReviewers(2, ['bob@foo.com'])).to.be.fulfilled;
		});
			
		it('#getReviewsIncludingReviewer after adding a reviewer', function () {
			return expect(Reviews.getReviewsIncludingReviewer('bob@foo.com'))
				.to.become([{
					"ix": 2,
					"title": "Bob's Code Review #2",
					"owner": "John Doe <john.doe@example.com>",
					"whenCreated": 1440047582964,
					"status": "complete",
					"statusLabel": null
				}, {
					"ix": 1,
					"title": "Test Review",
					"owner": "John Doe <john.doe@example.com>",
					"whenCreated": 1438456772247,
					"status": "active",
					"statusLabel": null
				}]);
		});
		it('#getReviewsExcludingReviewer after adding a reviewer', function () {
			return expect(Reviews.getReviewsExcludingReviewer('bob@foo.com'))
				.to.eventually.have.length(3);
		});
	});
});