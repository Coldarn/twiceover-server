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
	
	it('should send newReview emails immediately', function () {
		expect(Reviews.getReview(1)
			.then(Notification.newReview))
			.to.be.fulfilled;
		return waitForSendMail();
	});
});

function waitForSendMail() {
	return new Promise(function (resolve, reject) {
		var sendSpy = sandbox.spy(sender, 'sendMail');
		function check() {
			if (sendSpy.called) {
				resolve();
			} else {
				setTimeout(check, 5);
			}
		}
		check();
	});
}