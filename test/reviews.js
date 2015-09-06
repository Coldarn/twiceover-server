var chai = require('chai');
chai.use(require("chai-as-promised"));
var expect = chai.expect;
	
var fs = require('fs');
var path = require('path');

var TEST_FILES = 'test/files';
var TEST_TEMPLATES = 'test/templates';

var Data = {};
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
	
	describe('#addReviewers', function () {
		it('should be setup correctly', function () {
			return expect(Reviews.getReviewers(5)).to.become([Data.reviewers[0]]);
		});
		function addAndExpect(toAdd, toExpect) {
			return function () {
				Reviews.addReviewers(5, toAdd);
				return expect(Reviews.getReviewers(5)).to.become(eval(toExpect));	// eval to delay resolution
			}
		}
		it('should add bare emails', addAndExpect(['george@example.com'], 'Data.reviewers'));
		it('should deduplicate emails', addAndExpect(['george@example.com'], 'Data.reviewers'));
		it('should be case-insensitive', addAndExpect(['GEORGE@example.com'], 'Data.reviewersCapitalized'));
		it('should expand emails in-place', addAndExpect(['Bob George <george@example.com>'], 'Data.reviewersExpanded'));
		it('should expand emails in-place with duplicates',
			addAndExpect(['GEORGE@example.com', 'Bob George <george@example.com>'], 'Data.reviewersExpanded'));
		it('should still match bare emails', addAndExpect(['george@example.com'], 'Data.reviewers'));
		it('should dedupe and insert', addAndExpect(['george@example.com', 'bob@example.com'], 'Data.reviewersAdded'));
	});
	
	describe('#getReviews', function () {
		it('..IncludingReviewer before adding a reviewer', function () {
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
		it('..ExcludingReviewer before adding a reviewer', function () {
			return expect(Reviews.getReviewsExcludingReviewer('bob@foo.com'))
				.to.eventually.have.length(4);
		});
		
		it('add a reviewer', function () {
			return expect(Reviews.addReviewers(2, ['bob@foo.com'])).to.be.fulfilled;
		});
			
		it('..IncludingReviewer after adding a reviewer', function () {
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
		it('..ExcludingReviewer after adding a reviewer', function () {
			return expect(Reviews.getReviewsExcludingReviewer('bob@foo.com'))
				.to.eventually.have.length(3);
		});
	});
});

Data.reviewers = [
	{ name: 'coldarn@gmail.com', status: null, statusLabel: null },
	{ name: 'george@example.com', status: null, statusLabel: null }
];
Data.reviewersCapitalized = [
	Data.reviewers[0],
	{ name: 'GEORGE@example.com', status: null, statusLabel: null }
];
Data.reviewersExpanded = [
	Data.reviewers[0],
	{ name: 'Bob George <george@example.com>', status: null, statusLabel: null }
];
Data.reviewersAdded = [
	Data.reviewers[0],
	Data.reviewers[1],
	{ name: 'bob@example.com', status: null, statusLabel: null }
];