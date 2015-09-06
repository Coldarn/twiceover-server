'use strict';

var sqlite3 = require('sqlite3');

var Reviews = require('./reviews.js');
var Notification = require('./notification.js');
var config = require('./config.json');

var loadedReviews = {};

var proto = {
	reviewIndex: null,	// 1-based index of this review
	db: null,			// Connection to the review database
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
			me.promise.then(function () {
				if (me.clients.size === 0) {
					me.db.close();
					delete me.db;
					delete me.promise;
					delete loadedReviews[me.reviewIndex];
					console.log('review', me.reviewIndex, 'closed');					
				}
			});
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
		
		me.db.serialize(function () {
			me.db.run('BEGIN TRANSACTION');
			events.forEach(function (event) {
				me._addEvent(client, event);
			});
			me.db.run('COMMIT');
		});
	},
	
	addEvent: function (fromClient, event) {
		var me = this;
		me.promise.then(function () {
			me._addEvent(fromClient, event);
		});
	},
	
	_addEvent: function (fromClient, event) {
		var me = this,
			message;
		
		// SQLite doesn't store doubles with as much precision as JavaScript, so convert them to strings
		// to prevent data loss
		me.db.run('INSERT INTO log (id, type, user, data) VALUES (?,?,?,?)',
			String(event.id), event.type, event.user, JSON.stringify(event.data), broadcastEvent);
		
		function broadcastEvent(err) {
			if (err) return;	// The record is already saved
			
			me.eventLog.push(event);
			console.log('event:', event.id, event.type, event.user);
			
			switch (event.type) {
				case 'newReview':
					var review = {
						ix: me.reviewIndex,
						owner: event.user,
						title: event.data.title,
						description: event.data.description,
						whenCreated: Math.floor(event.id),
						status: event.data.status,
						statusLabel: event.data.statusLabel,
						reviewers: event.data.reviewers
					};
					Promise.all([
						Reviews.updateMetadata(me.reviewIndex, review),
						Reviews.addReviewers(me.reviewIndex, event.data.reviewers)
					]).then(function () {
						review.reviewers = review.reviewers.map(function (email) {
							return { name: email, status: null, statusLabel: null };
						});
						Notification.newReview(review);
					});
					break;
				case 'reviewerJoined':
					Reviews.addReviewers(me.reviewIndex, [event.data.reviewer]).then(function () {
						Notification.reviewerJoined(me.reviewIndex, event.data.reviewer);
					});
					break;
				case 'changeReviewStatus':
					message = {
						status: event.data.status,
						statusLabel: event.data.statusLabel,
						whenUpdated: Math.floor(event.id)
					};
					Reviews.updateMetadata(me.reviewIndex, message).then(function () {
						Notification.changeReviewStatus(me.reviewIndex, event.data.status, event.data.statusLabel);
					});
					break;
				case 'changeReviewerStatus':
					message = {
						name: event.data.reviewer,
						status: event.data.status,
						statusLabel: event.data.statusLabel
					};
					Reviews.updateReviewerStatus(me.reviewIndex, message).then(function () {
						Notification.changeReviewerStatus(me.reviewIndex, event.data.reviewer, event.data.status, event.data.label);
					});
					break;
			}
			
			message = JSON.stringify(event);
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
		reviewFilePath = require('path').join(config.reviews.path, index + '.db');
	if (obj) {
		return obj;
	}
	
	obj = Object.create(proto);
	obj.reviewIndex = index;
	obj.clients = new Set();
	obj.db = new sqlite3.Database(reviewFilePath);
	obj.promise = new Promise(function (resolve, reject) {
		obj.db.run('CREATE TABLE log (id TEXT, type TEXT, user TEXT COLLATE NOCASE, data TEXT,'
				+ ' UNIQUE(id, user) ON CONFLICT ABORT)', createDone);
				
		function createDone(err) {
			// Don't bother to check err, it'll fail whenver the table already exists
			obj.db.all('SELECT id, type, user, data FROM log ORDER BY rowid ASC', loadDone);
		}
		function loadDone(err, rows) {
			console.log('review', index, 'loaded with', rows.length, 'events');
			
			obj.eventLog = rows.map(function (row) {
				row.id = Number(row.id);		// Convert IDs back to Numbers
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