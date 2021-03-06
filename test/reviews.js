/* global before */
/* global it */
/* global describe */

var chai = require('chai');
chai.use(require("chai-as-promised"));
var expect = chai.expect;
var Promise = require('bluebird');

var TestHelper = require('./test-helper.js');

var Data = {};
var Reviews;

describe('Reviews', function () {
	before(function () {
		TestHelper.setupTestFolder(__filename, ['reviews.db']);
	});
	
	it('module should initialize properly', function () {
		Reviews = require('../srv/reviews.js');
		expect(Reviews).to.be.ok;
		
		// Turn off error logging to keep the run reports clean
		Reviews._logErrors = false;
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
	
	describe('#getReviewIndex', function () {
		it('should reject with invalid review indexes', function () {
			return expect(Reviews.getReviewIndex(99)).to.be.rejectedWith(Error);
		});
		it('should reject with invalid review IDs', function () {
			return expect(Reviews.getReviewIndex('abcdefg')).to.be.rejectedWith(Error);
		});
		it('should resolve with valid review indexes', function () {
			return expect(Reviews.getReviewIndex(3)).to.become(3);
		});
		it('should resolve with valid review indexes', function () {
			return expect(Reviews.getReviewIndex('odaxW8dyuQVEUDKneBe6TNW')).to.become(3);
		});
	});
	
	describe('#getOrCreateReview', function () {
		it('should start with a known state', function () {
			return expect(Reviews.getRecentReviews()).to.eventually.have.length(5);
		});
		it('should return indexes for known review IDs', function () {
			return expect(Promise.all([
				expect(Reviews.getOrCreateReview('7kULUz32rDthib47gMQQMoc')).to.become(2),
				expect(Reviews.getRecentReviews()).to.eventually.have.length(5)
			])).to.be.fulfilled;
		});
		it('should reject for invalid IDs', function () {
			return expect(Promise.all([
				expect(Reviews.getOrCreateReview('7kULUz32rDthib47gMQQM')).to.be.rejectedWith(Error),
				expect(Reviews.getOrCreateReview('7kULUz32rDthib47gMQQMocww')).to.be.rejectedWith(Error),
				expect(Reviews.getOrCreateReview(null)).to.be.rejectedWith(Error),
				expect(Reviews.getOrCreateReview(99)).to.be.rejectedWith(Error)
			])).to.be.fulfilled;
		});
		it('should insert new reviews for valid IDs', function () {
			return expect(Promise.all([
				expect(Reviews.getOrCreateReview('7kULUz32rDthib47gMQQMo0')).to.become(6),
				expect(Reviews.getRecentReviews()).to.eventually.have.length(6),
				expect(Reviews.getReview(6)).to.become(Data.reviews[6])
			])).to.be.fulfilled;
		});
		it('should be case-SENSITIVE', function () {
			return expect(Promise.all([
				expect(Reviews.getOrCreateReview('7KULUz32rDthib47gMQQMo0')).to.become(7),
				expect(Reviews.getRecentReviews()).to.eventually.have.length(7)
			])).to.be.fulfilled;
		});
		it('should clean up successfully', function () {
			return expect(Reviews._db.runAsync('DELETE FROM reviews WHERE ix > 5')).to.be.fulfilled;
		});
	});
	
	describe('#getReview', function () {
		it('should reject with invalid review indexes', function () {
			return expect(Reviews.getReview(99)).to.be.rejectedWith(Error);
		});
		it('should return the expected fields by index', function () {
			return expect(Reviews.getReview(2)).to.become(Data.reviews[2].base);
		});
		it('should work with ID strings', function () {
			return expect(Reviews.getReview('7kULUz32rDthib47gMQQMoc')).to.become(Data.reviews[2].base);
		});
	});
	
	describe('#updateMetadata', function () {
		it('should reject with invalid metadata', function () {
			return expect(Reviews.updateMetadata(1, null)).to.be.rejectedWith(Error);
		});
		it('should reject with empty metadata object', function () {
			return expect(Reviews.updateMetadata(1, {})).to.be.rejectedWith(Error);
		});
		it('should reject with no matching metadata fields', function () {
			return expect(Reviews.updateMetadata(1, { bazinga: 12 })).to.be.rejectedWith(Error);
		});
		it('should harmlessly do nothing with invalid review ids', function () {
			return expect(Promise.all([
				Reviews.updateMetadata(99, { description: "It's a no-go." }),
				expect(Reviews.getRecentReviews()).to.eventually.have.length(5)
			])).to.be.fulfilled;
		});
		it('should update a single field correctly', function () {
			return expect(Promise.all([
				Reviews.updateMetadata(2, { description: Data.reviews[2].updatedDesc.description }),
				expect(Reviews.getReview(2)).to.become(Data.reviews[2].updatedDesc)
			])).to.be.fulfilled;
		});
		it('should update all fields by index', function () {
			return expect(Promise.all([
				Reviews.updateMetadata(2, Data.reviews[2].updatedAll),
				expect(Reviews.getReview(2)).to.become(Data.reviews[2].updatedAll)
			])).to.be.fulfilled;
		});
		it('should update all fields by ID', function () {
			return expect(Promise.all([
				Reviews.updateMetadata('7kULUz32rDthib47gMQQMoc', Data.reviews[2].base),
				expect(Reviews.getReview(2)).to.become(Data.reviews[2].base)
			])).to.be.fulfilled;
		});
	});
	
	describe('#addReviewers', function () {
		it('should be setup correctly', function () {
			return expect(Reviews.getReviewers(5)).to.become([Data.reviewers[5].base[0]]);
		});
		function addAndExpect(toAdd, toExpect) {
			return function () {
				Reviews.addReviewers(5, toAdd);
				return expect(Reviews.getReviewers(5)).to.become(eval(toExpect));	// eval to delay resolution
			}
		}
		it('should add bare emails', addAndExpect(['george@example.com'], 'Data.reviewers[5].base'));
		it('should deduplicate emails', addAndExpect(['george@example.com'], 'Data.reviewers[5].base'));
		it('should be case-insensitive', addAndExpect(['GEORGE@example.com'], 'Data.reviewers[5].capitalized'));
		it('should expand emails in-place', addAndExpect(['Bob George <george@example.com>'], 'Data.reviewers[5].expanded'));
		it('should expand emails in-place with duplicates',
			addAndExpect(['GEORGE@example.com', 'Bob George <george@example.com>'], 'Data.reviewers[5].expanded'));
		it('should still match bare emails', addAndExpect(['george@example.com'], 'Data.reviewers[5].base'));
		it('should dedupe and insert', addAndExpect(['george@example.com', 'bob@example.com'], 'Data.reviewers[5].added'));
	});
	
	describe('#updateReviewerStatus', function () {
		it('should be setup correctly', function () {
			return expect(Reviews.getReviewers(3)).to.become(Data.reviewers[3].base);
		});
		function updateAndExpect(update, toExpect) {
			return function () {
				Reviews.updateReviewerStatus(3, eval(update));
				return expect(Reviews.getReviewers(3)).to.become(eval(toExpect));	// eval to delay resolution
			}
		}
		it('should update status with bare emails', updateAndExpect('Data.reviewers[3].baseUpdated[0]', 'Data.reviewers[3].baseUpdated'));
		it('should expand emails while updating status', updateAndExpect('Data.reviewers[3].expanded[0]', 'Data.reviewers[3].expanded'));
		it('should still update status with bare email', updateAndExpect('Data.reviewers[3].baseUpdated[0]', 'Data.reviewers[3].baseUpdated'));
		it('should update second status fully', updateAndExpect('Data.reviewers[3].secondUpdate[1]', 'Data.reviewers[3].secondUpdate'));
		it('should update second status partially', updateAndExpect('Data.reviewers[3].secondUpdate2[1]', 'Data.reviewers[3].secondUpdate2'));
		it('should add reviewers', updateAndExpect('Data.reviewers[3].thirdUpdate[3]', 'Data.reviewers[3].thirdUpdate'));
	});
	
	describe('#getReviews', function () {
		it('matching by substring', function () {
			return expect(Promise.all([
				expect(Reviews.getReviewsIncludingReviewer('bob.smith@example.com')).to.eventually.have.length(5),
				expect(Reviews.getReviewsExcludingReviewer('bob.smith@example.com')).to.eventually.have.length(0),
			])).to.be.fulfilled;							
		});
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

Data.reviews = {
	2: {
		base: {
			"ix":2,
			"id":"7kULUz32rDthib47gMQQMoc",
			"title":"Bob's Code Review #2",
			"description":"",
			"owner":"John Doe <john.doe@example.com>",
			"whenCreated":1440047582964,
			"status":"complete",
			"statusLabel":null,
			"whenUpdated":1440559322417,
			"reviewers":[
				{"name":"bob.smith@example.com","status":null,"statusLabel":null},
				{"name":"bonzai@foo.com","status":null,"statusLabel":null},
				{"name":"john.doe@example.com","status":null,"statusLabel":null},
				{"name":"john.smith@example.com","status":null,"statusLabel":null}
			]
		}
	},
	6: {
		"ix":6,
		"id":"7kULUz32rDthib47gMQQMo0",
		"title":null,
		"description":null,
		"owner":null,
		"whenCreated":null,
		"status":"active",
		"statusLabel":null,
		"whenUpdated":null,
		"reviewers":[]
	}
}
Data.reviews[2].updatedDesc = JSON.parse(JSON.stringify(Data.reviews[2].base));
Data.reviews[2].updatedDesc.description = "Here's a description";

Data.reviews[2].updatedAll = JSON.parse(JSON.stringify(Data.reviews[2].base));
Data.reviews[2].updatedAll.title = "CR #2";
Data.reviews[2].updatedAll.description = "A NEW description!";
Data.reviews[2].updatedAll.owner = "foo@example.com";
Data.reviews[2].updatedAll.whenCreated = 1441572281122;
Data.reviews[2].updatedAll.status = "aborted";
Data.reviews[2].updatedAll.statusLabel = "Aborted";
Data.reviews[2].updatedAll.whenUpdated = 1441572314992;

Data.reviewers = {
	5: { base: [
		{ name: 'coldarn@gmail.com', status: null, statusLabel: null },
		{ name: 'george@example.com', status: null, statusLabel: null }
	]},
	3: { base: [
		{ name: 'bob.smith@example.com', status: null, statusLabel: null },
		{ name: 'john.doe@example.com', status: null, statusLabel: null },
		{ name: 'bonzai@foo.com', status: null, statusLabel: null }
	]}
};
Data.reviewers[5].capitalized = [
	Data.reviewers[5].base[0],
	{ name: 'GEORGE@example.com', status: null, statusLabel: null }
];
Data.reviewers[5].expanded = [
	Data.reviewers[5].base[0],
	{ name: 'Bob George <george@example.com>', status: null, statusLabel: null }
];
Data.reviewers[5].added = [
	Data.reviewers[5].base[0],
	Data.reviewers[5].base[1],
	{ name: 'bob@example.com', status: null, statusLabel: null }
];


Data.reviewers[3].baseUpdated = [
	{ name: 'bob.smith@example.com', status: 'active', statusLabel: 'Active' },
	Data.reviewers[3].base[1],
	Data.reviewers[3].base[2]
];
Data.reviewers[3].expanded = [
	{ name: 'Bob Smith <bob.smith@example.com>', status: null, statusLabel: null },
	Data.reviewers[3].base[1],
	Data.reviewers[3].base[2]
];
Data.reviewers[3].expandedUpdated = [
	{ name: 'Bob Smith <bob.smith@example.com>', status: 'active', statusLabel: 'Active' },
	Data.reviewers[3].base[1],
	Data.reviewers[3].base[2]
];
Data.reviewers[3].secondUpdate = [
	{ name: 'bob.smith@example.com', status: 'active', statusLabel: 'Active' },
	{ name: 'john.doe@example.com', status: 'needsWork', statusLabel: 'Needs Work' },
	Data.reviewers[3].base[2]
];
Data.reviewers[3].secondUpdate2 = [
	Data.reviewers[3].secondUpdate[0],
	{ name: 'john.doe@example.com', status: 'needsWork', statusLabel: 'Need to update doco and fix styling' },
	Data.reviewers[3].base[2]
];
Data.reviewers[3].thirdUpdate = [
	Data.reviewers[3].secondUpdate[0],
	Data.reviewers[3].secondUpdate2[1],
	Data.reviewers[3].base[2],
	{ name: 'john.smith@example.com', status: 'looksGood', statusLabel: 'Looks Good' },
];