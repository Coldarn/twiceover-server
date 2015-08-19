'use strict';

var fs = require('fs');
var express = require('express');
var path = require('path');
var WebSocketServer = require('ws').Server;
var http = require('http');
	
var Reviews = require('./reviews.js');
var Review = require('./review.js');

var PORT = 3000;



var app = express();
app.use(express.static(path.join(__dirname, 'www')));

app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

app.get('/api/reviews', function (req, res) {
	Reviews.getRecentReviews().then(function (reviews) {
		res.json(reviews);
	}, function (err) {
		res.sendStatus(400);
	});
});
app.get('/api/review/:ix', function (req, res) {
	Reviews.getReview(Number(req.params.ix)).then(function (review) {
		res.json(review);
	}, function (err) {
		res.sendStatus(400);
	});
});
app.get('/api/user/:email', function (req, res) {
	Reviews.getReviewsByReviewer(req.params.email).then(function (reviews) {
		res.json(reviews);
	}, function (err) {
		res.sendStatus(400);
	});
});


var server = http.createServer(app);
server.listen(PORT);



var wss = new WebSocketServer({ server: server });
wss.on('connection', function connection(ws) {
	console.log('client connected');
	
	ws.on('message', function incoming(message) {
        var event = JSON.parse(message);
		
		switch(event.protocol) {
			case 'syncReview':
				Reviews.getOrCreateReview(event.reviewID)
					.then(function (index) {
						console.log('synchronizing review:', index, event.reviewID);
						var review = Review(index);
						if (ws.review) {
							ws.review.removeClient(ws);
						}
						ws.review = review;
						review.addClient(ws, event.log);
					});
				break;
			case 'loadReview':
				Reviews.getReviewIndex(event.reviewID).then(function (index) {
					console.log('loading review:', index, event.reviewID);
					var review = Review(index);
					if (ws.review) {
						ws.review.removeClient(ws);
					}
					ws.review = review;
					review.addClient(ws, []);
				}, function (err) {
					ws.send(JSON.stringify({ error: 'No review found with ID "' + event.reviewID + '"' }));
				});
				break;
			default:
				ws.review.addEvent(ws, event);
				break;
		}
	});
	ws.on('close', function closing(code, message) {
		console.log('client disconnect:', code, message);
		if (ws.review) {
			ws.review.removeClient(ws);
			delete ws.review;
		}
	});
});


console.log('server listeneing on port', PORT);


// Converts the [seconds, nanoseconds] structs into ms doubles
function hrms() {
	var t = process.hrtime();
	return t[0] * 1e3 + t[1] / 1e6;
}

var highResTimeBase = Date.now() - hrms();

// Returns JS ms now timestamps with at least 100 ns precision 
function highResTime() {
	return highResTimeBase + hrms();
}