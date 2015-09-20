var fs = require('fs');
var os = require('os');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var cons = require('consolidate');

var CONFIG = require('../config.json');
var HOST_INFO = CONFIG.host;
var User = require('./util/user.js');
var Reviews = require('./reviews.js');
var ThrottleQueue = require('./util/ThrottleQueue.js');

if (!CONFIG.mailserver.host) {
	console.warn('To enable email notification, put SMTP connection details into config.json#mailserver as documented here:\nhttps://github.com/andris9/nodemailer-smtp-transport#usage\n');
} else {
	var sender = nodemailer.createTransport(smtpTransport(CONFIG.mailserver));
}

var FROM_ADDR = '"Twice-Over" <no-reply@' + HOST_INFO.name + '>';
var PORT_STR = HOST_INFO.port && HOST_INFO.port != 80 ? ':' + HOST_INFO.port : '';
var CLIENT_DOWNLOAD_LINK = ['http://', HOST_INFO.name, PORT_STR, '/Twice-OverSetup.exe'].join('');

function buildReviewLink(reviewId) {
	return ['twiceover://', HOST_INFO.name, PORT_STR, '/review/', reviewId].join('');
}

module.exports = {
	logEvents: true,
	
	newReview: function (review) {
		log('notification: newReview', review.ix);
		sendMail('New Review ' + review.ix + ': ' + review.title, review);
	},
	
	reviewerJoined: function (reviewIndex, newReviewer) {
		var user = User(newReviewer);
		getReviewAndSend('Review ' + reviewIndex + ': ' + user.getName() + ' Joined!', reviewIndex, true);
	},
	
	reviewerAdded: function (reviewIndex, newReviewer) {
		var user = User(newReviewer);
		getReviewAndSend('Review ' + reviewIndex + ': ' + user.getName() + ' Invited!', reviewIndex);
	},
	
	changeReviewStatus: function (reviewIndex, status, statusLabel) {
		queueEvent('changeReviewStatus', reviewIndex, statusLabel);
	},
	
	changeReviewerStatus: function (reviewIndex, email, status, statusLabel) {
		var user = User(email);
		queueEvent('changeReviewerStatus', reviewIndex, user.getName() + ' changed status to ' + statusLabel, user.email);
	}
};

function log() {
	if (module.exports.logEvents) {
		console.log.apply(console, arguments);
	}
}

var eventQueue = ThrottleQueue('notifications', function handleEvent(events) {
	events.forEach(function (event) {
		getReviewAndSend('Review ' + event.data.reviewIndex + ': ' + event.data.message, event.data.reviewIndex);
	});
});

function queueEvent(eventType, reviewIndex, message, extraKey) {
	var key = reviewIndex + '-' + eventType + (extraKey ? '-' + extraKey : '').toLowerCase();
	eventQueue.add(key, { reviewIndex: reviewIndex, message: message });
}

function getReviewAndSend(mailTitle, reviewIndex, sendOnlyToOwner) {
	log('notification:', mailTitle);
	if (!sender) {
		return;
	}
	Reviews.getReview(reviewIndex).then(function (review) {
		sendMail(mailTitle, review, sendOnlyToOwner);
	}, function (err) {
		console.error(err);
	});
}

function sendMail(mailTitle, review, sendOnlyToOwner) {
	if (!sender) {
		return;
	}
	review.downloadLink = CLIENT_DOWNLOAD_LINK;
	review.reviewLink = buildReviewLink(review.id);
	Promise.all([
		cons.mustache('email/ReviewStatus.html', review),
		cons.mustache('email/ReviewStatus.txt', review)
	]).then(function (templates) {
		sender.sendMail({
			from: FROM_ADDR,
			replyTo: review.owner,
			to: sendOnlyToOwner
				? review.owner
				: [review.owner].concat(review.reviewers.map(function (r) { return r.name; })),
			subject: mailTitle,
			text: templates[1],
			html: templates[0]
		}, function (err, info) {
			if (err) return console.error(err);
			log(info.response);
		});
	});
}