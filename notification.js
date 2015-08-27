var fs = require('fs');
var os = require('os');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

if (!fs.existsSync('mailserver.json')) {
	console.warn('File "mailserver.json" not found, disabling email notification.')
	console.warn('To enable it, place the file next to package.json and fill it with an options configuration object, as documented here:\nhttps://github.com/andris9/nodemailer-smtp-transport#usage\n');
} else {
	var sender = nodemailer.createTransport(smtpTransport(JSON.parse(fs.readFileSync('mailserver.json'))));
}


var HOST_INFO = require('./host.json');
var Reviews = require('./reviews.js');


function buildReviewLink(reviewIndex) {
	return ['twiceover://', HOST_INFO.name, ':', HOST_INFO.port,
		'/api/review/', reviewIndex].join('');
}


module.exports = {
	newReview: function (review) {
		var reviewLink = buildReviewLink(review.ix);
		
		sender.sendMail({
			from: '"Twice-Over" <no-reply@' + HOST_INFO.name + '>',
			replyTo: review.owner,
			to: [review.owner].concat(review.reviewers),
			subject: 'New Review: ' + review.title,
			text: reviewLink + '\n\n' + review.description,
			html: ['<a href="', reviewLink, '">Code Review ', review.ix, ': ', review.title,
				'</a><br/><br/>', review.description].join('') 
		}, function (err, info) {
			if (err) return console.error(err);
			console.log(info.response);
		});
	},
	
	reviewerJoined: function (reviewIndex, newReviewer) {
		var reviewerName = newReviewer.substring(0, newReviewer.indexOf('<')).trim() || newReviewer;
		var reviewLink = buildReviewLink(reviewIndex);
		
		Reviews.getReview(reviewIndex).then(function (review) {
			sender.sendMail({
				from: '"Twice-Over" <no-reply@' + HOST_INFO.name + '>',
				replyTo: review.owner,
				to: [review.owner, newReviewer].concat(review.reviewers),
				subject: 'Review ' + reviewIndex + ': ' + reviewerName + ' Joined!',
				text: reviewLink + '\n\n' + review.description,
				html: ['<a href="', reviewLink, '">Code Review ', review.ix, ': ', review.title,
					'</a><br/><br/>', reviewerName, ' has started reviewing!'].join('') 
			}, function (err, info) {
				if (err) return console.error(err);
				console.log(info.response);
			});
		}, function (err) {
			console.error(err);
		})
	}
};