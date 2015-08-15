'use strict';

var path = require('path');
var sqlite3 = require('sqlite3');

var db = new sqlite3.Database(path.join('reviews', 'reviews.db'));

// Don't care if this fails, that just means the table already exists
db.run('CREATE TABLE reviews (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, owner TEXT NOT NULL)', function (err) { });
	
module.exports = {
	getRecentReviews: function () {
		return new Promise(function (resolve, reject) {
			db.all('SELECT rowid, title, description, owner FROM reviews ORDER BY rowid DESC LIMIT 1000', getDataDone);
			function getDataDone(err, rows) {
				if (err) reject(err);
				resolve(rows);
			}
		});
	},
	
	getReviewIndex: function (reviewID) {
		return new Promise(function (resolve, reject) {
			db.get('SELECT rowid FROM reviews WHERE id = ?', reviewID, getIndexDone);
			
			function getIndexDone(err, row) {
				if (err) reject(err);
				resolve(row.rowid);
			}
		});
	},
	
	getOrCreateReview: function (reviewID, title, description, owner) {
		var me = this;
		
		return new Promise(function (resolve, reject) {
			db.run('INSERT OR IGNORE INTO reviews (id, title, description, owner) VALUES (?, ?, ?, ?)',
				reviewID, title, description, owner, insertDone);
				
			function insertDone(err) {
				if (err) reject(err);
				resolve(me.getReviewIndex(reviewID));
			}
		});
	}
};