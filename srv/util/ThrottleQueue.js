
var path = require('path');
var sqlite3 = require('sqlite3');
var Promise = require('bluebird');

var config = require('./../../config.json');

var proto = {
	throttleDelay: 1 * 60000,	// 1 Minute throttle window by default
	db: null,
	handlerFn: null,
	
	// Adds the given event data to the event queue, replacing prior data with the same key if present.
	// After throttleDelay ms this event will be returned to the given handlerFn if not replaced by newer
	// data in the interim.
	add: function (eventKey, eventDataJson) {
		this.db.run('INSERT OR REPLACE INTO events (key, processTime, data) VALUES (?, ?, ?)',
			eventKey, Date.now() + this.throttleDelay, JSON.stringify(eventDataJson));
	},
	
	processQueue: function () {
		var me = this,
			processTime = Date.now();
			
		// Grab all settled events
		me.db.allAsync('SELECT key, data FROM events WHERE processTime <= ?', processTime).then(function (rows) {
			// Fire off the entire batch so the consumer can deduplicate further if desired
			rows.forEach(function (row) {
				row.data = JSON.parse(row.data);
			});
			if (rows.length) {
				me.handlerFn(rows);
			}
		}).then(function () {
			// Clear them from the queue
			return me.db.run('DELETE FROM events WHERE processTime <= ?', processTime);
		}).finally(function () {
			// Schedule our next round
			setTimeout(me.processQueue.bind(me), me.throttleDelay);
		});
	}
};

function ThrottleQueue(queueName, eventHandlerFn) {
	var obj = Object.create(proto);
	
	obj.handlerFn = eventHandlerFn;
	obj.db = new sqlite3.Database(path.join(config.reviews.path, queueName + '.db'));
	
	obj.db.run("CREATE TABLE events (key TEXT PRIMARY KEY, processTime INTEGER NOT NULL, data TEXT NOT NULL)", function () {
		obj.processQueue();
	});
	
	return obj;
}

module.exports = ThrottleQueue;
