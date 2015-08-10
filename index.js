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
	fs.readdir(path.join(__dirname, 'reviews'), function (err, files) {
		res.json(files);
	});
});
app.get('/api/review/:id.json', function (req, res) {
	var fileName = path.join(__dirname, 'reviews', req.params.id + '.json');
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




var wss = new WebSocketServer({ server: server });
wss.on('connection', function connection(ws) {
	console.log('client connected');
	
	ws.on('message', function incoming(message) {
		console.log('received: %s', message);
	});
	
	ws.send('something');
});