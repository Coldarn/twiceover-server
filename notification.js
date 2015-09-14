var fs = require('fs');
var os = require('os');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var cons = require('consolidate');

if (!fs.existsSync('mailserver.json')) {
	console.warn('File "mailserver.json" not found, disabling email notification.')
	console.warn('To enable it, place the file next to package.json and fill it with an options configuration object, as documented here:\nhttps://github.com/andris9/nodemailer-smtp-transport#usage\n');
} else {
	var sender = nodemailer.createTransport(smtpTransport(JSON.parse(fs.readFileSync('mailserver.json'))));
}


var HOST_INFO = require('./config.json').host;
var User = require('./user.js');
var Reviews = require('./reviews.js');
var ThrottleQueue = require('./srv/util/ThrottleQueue.js');

var FROM_ADDR = '"Twice-Over" <no-reply@' + HOST_INFO.name + '>';
var PORT_STR = HOST_INFO.port && HOST_INFO.port != 80 ? ':' + HOST_INFO.port : '';
var CLIENT_DOWNLOAD_LINK = ['http://', HOST_INFO.name, PORT_STR, '/Twice-OverSetup.exe'].join('');

function buildReviewLink(reviewIndex) {
	return ['twiceover://', HOST_INFO.name, PORT_STR, '/api/review/', reviewIndex].join('');
}

module.exports = {
	newReview: function (review) {
		console.log('notification: newReview', review.ix);
		sendMail('New Review ' + review.ix + ': ' + review.title, review);
	},
	
	reviewerJoined: function (reviewIndex, newReviewer) {
		var user = User(newReviewer);
		getReviewAndSend('Review ' + reviewIndex + ': ' + user.getName() + ' Joined!', reviewIndex);
	},
	
	changeReviewStatus: function (reviewIndex, status, statusLabel) {
		queueEvent('changeReviewStatus', reviewIndex, statusLabel);
	},
	
	changeReviewerStatus: function (reviewIndex, email, status, statusLabel) {
		var user = User(email);
		queueEvent('changeReviewerStatus', reviewIndex, user.getName() + ' changed status to ' + statusLabel, user.email);
	}
};

var eventQueue = ThrottleQueue('notifications', function handleEvent(events) {
	events.forEach(function (event) {
		getReviewAndSend('Review ' + event.data.reviewIndex + ': ' + event.data.message, event.data.reviewIndex);
	});
});

function queueEvent(eventType, reviewIndex, message, extraKey) {
	var key = reviewIndex + '-' + eventType + (extraKey ? '-' + extraKey : '').toLowerCase();
	eventQueue.add(key, { reviewIndex: reviewIndex, message: message });
}

function getReviewAndSend(mailTitle, reviewIndex) {
	console.log('notification:', mailTitle);
	if (!sender) {
		return;
	}
	Reviews.getReview(reviewIndex).then(function (review) {
		sendMail(mailTitle, review);
	}, function (err) {
		console.error(err);
	});
}

function sendMail(mailTitle, review) {
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
			to: [review.owner].concat(review.reviewers),
			subject: mailTitle,
			text: templates[1],
			html: templates[0]
		}, function (err, info) {
			if (err) return console.error(err);
			console.log(info.response);
		});
	});
}