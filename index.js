'use strict';

var fs = require('fs');
var express = require('express');
var path = require('path');
var WebSocketServer = require('ws').Server;
var http = require('http');
	
var PORT = 3000;


var app = express();
app.use(express.static(path.join(__dirname, 'www')));

app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

app.get('/api/reviews', function (req, res) {
	Storage.getRecentReviews().then(function (reviews) {
		res.json(reviews);
	}, function (err) {
		res.status(500).end();
	});
});
app.get('/api/review/:id', function (req, res) {
	var fileName = path.join(__dirname, 'reviews', req.params.id + '.db');
	fs.stat(fileName, function (err, stats) {
		if (err || !stats || !stats.isFile()) {
			res.sendStatus(404);
		} else {
			res.sendFile(fileName);
		}
	})
});

var server = http.createServer(app);
server.listen(PORT);



var Review = require('./review.js');
var Storage = require('./storage.js');

var wss = new WebSocketServer({ server: server });
wss.on('connection', function connection(ws) {
	console.log('client connected');
	
	ws.on('message', function incoming(message) {
        var event = JSON.parse(message);
		
		switch(event.protocol) {
			case 'syncReview':
				Storage.getReviewIndex(event.reviewID, event.title, event.description, event.owner)
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