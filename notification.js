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


var HOST_INFO = require('./host.json');
var Reviews = require('./reviews.js');

var FROM_ADDR = '"Twice-Over" <no-reply@' + HOST_INFO.name + '>';
var PORT_STR = HOST_INFO.port && HOST_INFO.port != 80 ? ':' + HOST_INFO.port : '';
var CLIENT_DOWNLOAD_LINK = ['http://', HOST_INFO.name, PORT_STR, '/Twice-OverSetup.exe'].join('');

function buildReviewLink(reviewIndex) {
	return ['twiceover://', HOST_INFO.name, PORT_STR, '/api/review/', reviewIndex].join('');
}
function getName(email) {
	return email.substring(0, email.indexOf('<')).trim() || email;
}

module.exports = {
	newReview: function (review) {
		console.log('notification: newReview', review.ix);
		sendMail('New Review ' + review.ix + ': ' + review.title, review);
	},
	
	reviewerJoined: function (reviewIndex, newReviewer) {
		console.log('notification: reviewerJoined', reviewIndex);
		getReviewAndSend('Review ' + reviewIndex + ': ' + getName(newReviewer) + ' Joined!', reviewIndex);
	},
	
	changeReviewStatus: function (reviewIndex, status, statusLabel) {
		console.log('notification: changeReviewStatus', reviewIndex);
		getReviewAndSend('Review ' + reviewIndex + ': ' + statusLabel, reviewIndex);
	},
	
	changeReviewerStatus: function (reviewIndex, email, status, statusLabel) {
		console.log('notification: changeReviewerStatus', reviewIndex);
		getReviewAndSend('Review ' + reviewIndex + ': ' + getName(email)
			+ ' changed status to ' + statusLabel, reviewIndex);
	}
};

function getReviewAndSend(mailTitle, reviewIndex) {
	Reviews.getReview(reviewIndex).then(function (review) {
		review.downloadLink = CLIENT_DOWNLOAD_LINK;
		review.reviewLink = buildReviewLink(review.ix);
		sendMail(mailTitle, review);
	}, function (err) {
		console.error(err);
	})
}

function sendMail(mailTitle, review) {
	review.downloadLink = CLIENT_DOWNLOAD_LINK;
	review.reviewLink = buildReviewLink(review.ix);
	cons.mustache('email/ReviewStatus.html', review).then(function (template) {
		// console.log(template);
		
		if (!sender) {
			return;
		}
		sender.sendMail({
			from: FROM_ADDR,
			replyTo: review.owner,
			to: [review.owner].concat(review.reviewers),
			subject: 'New Review: ' + review.title,
			text: review.reviewLink + '\n\n' + review.description,
			html: template
		}, function (err, info) {
			if (err) return console.error(err);
			console.log(info.response);
		});
	});
}