'use strict';

var sqlite3 = require('sqlite3');

var loadedReviews = {};

var proto = {
	db: null,
	promise: null,		// Promise resolved once the review has been fully loaded
	eventLog: null,		// Array of event objects
	clients: null,		// Set of web socket clients
	
	addClient: function (client, events) {
		var me = this;
		me.promise.then(function () {
			me.clients.add(client);
			me.syncClient(client, events);
		});
	},
	
	removeClient: function (client) {
		var me = this;
		this.promise.then(function () {
			me.clients.delete(client);
		});
	},
	
	syncClient: function (client, events) {
		var me = this;
		var clientEvents = events.reduce(function (set, event) {
			set.add(event.id + '/' + event.user.toLowerCase());
			return set;
		}, new Set());
		
		var newToClient = me.eventLog.filter(function (event) {
			return !clientEvents.has(event.id + '/' + event.user.toLowerCase());
		});
		
		console.log('sending', newToClient.length, 'event(s) to the client');
		client.send(JSON.stringify(newToClient));
		
		events.forEach(function (event) {
			me.addEvent(client, event);
		});
	},
	
	addEvent: function (fromClient, event) {
		var me = this;
		
		me.promise.then(function () {
			me.db.run('INSERT INTO log (id, type, user, data) VALUES (?,?,?,?)',
				event.id, event.type, event.user, JSON.stringify(event.data), broadcastEvent);
		});
		
		function broadcastEvent(err) {
			if (err) return;	// The record is already saved
			
			me.eventLog.push(event);
			console.log('event:', event.id, event.type, event.user);
			
			var message = JSON.stringify(event);
			for (var ws of me.clients) {
				if (ws !== fromClient) {
					ws.send(message);
				}
			}
		}
	}
};

function Review(index) {
	var obj = loadedReviews[index],
		reviewFilePath = 'reviews/' + index + '.db';
	if (obj) {
		return obj;
	}
	
	obj = Object.create(proto);
	obj.reviewIndex = index;
	obj.clients = new Set();
	obj.db = new sqlite3.Database(reviewFilePath);
	obj.promise = new Promise(function (resolve, reject) {
		obj.db.run('CREATE TABLE log (id REAL, type TEXT, user TEXT COLLATE NOCASE, data TEXT,'
				+ ' UNIQUE(id, user) ON CONFLICT ABORT)', createDone);
				
		function createDone(err) {
			// Don't bother to check err, it'll fail whenver the table already exists
			obj.db.all('SELECT id, type, user, data FROM log ORDER BY rowid ASC', loadDone);
		}
		function loadDone(err, rows) {
			console.log('review', index, 'loaded with', rows.length, 'events');
			
			obj.eventLog = rows.map(function (row) {
				row.data = JSON.parse(row.data);
				return row;
			});
			resolve();
		}
	})
	
	loadedReviews[index] = obj;
	return obj;
}

module.exports = Review;