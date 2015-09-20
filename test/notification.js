/* global describe */
/* global before */
/* global afterEach */
/* global it */

var chai = require('chai');
chai.use(require("chai-as-promised"));
var expect = chai.expect;
var Promise = require('bluebird');
var sinon = require('sinon');

var TestHelper = require('./test-helper.js');
var Reviews = require('../srv/reviews.js');

var sandbox = sinon.sandbox.create();
var sender = {
	sendMail: function (options, callback) { }
};

var Data = {};
var Notification;

describe('Notification', function () {
	before(function () {
		var config = TestHelper.setupTestFolder(__filename, ['reviews.db']);
		config.mailserver.host = "localhost";
		
		var nodemailer = require('nodemailer');
		sinon.stub(nodemailer, 'createTransport').returns(sender);
		
		var ThrottleQueue = require('../srv/util/ThrottleQueue.js');
		ThrottleQueue.prototype.throttleDelay = 1e12;	// We'll trigger processQueue manually for testing
	});
	
	afterEach(function () {
		sandbox.restore();
	})
	
	it('module should initialize properly', function () {
		Notification = require('../srv/notification.js');
		expect(Notification).to.be.ok;
		Notification.logEvents = false;
	});
	
	describe('newReview', function () {
		it('should send emails immediately', function () {
			Notification.newReview(Data.reviews[2]);
			return expect(waitForSendMail()).to.be.fulfilled;
		});
		
		it('should send mail with expected values', function () {
			Notification.newReview(Data.reviews[2]);
			return expect(waitForSendMail()
				.then(function (sendSpy) {
					expect(sendSpy.callCount).to.equal(1);
					expect(sendSpy.firstCall.args).to.have.length(2);
					expect(sendSpy.firstCall.args[0].subject).to.equal("New Review 2: Bob's Code Review #2");
					expect(sendSpy.firstCall.args[0].to).to.have.length(5);
					expect(sendSpy.firstCall.args[0].replyTo).to.equal("John Doe <john.doe@example.com>");
				})).to.be.fulfilled;
		});
	});
});

function waitForSendMail() {
	return new Promise(function (resolve, reject) {
		var sendSpy = sandbox.spy(sender, 'sendMail');
		function check() {
			if (sendSpy.called) {
				resolve(sendSpy);
			} else {
				setTimeout(check, 5);
			}
		}
		check();
	});
}

Data.reviews = {
	2: {
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