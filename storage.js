'use strict';

var path = require('path');
var sqlite3 = require('sqlite3');

var db = new sqlite3.Database(path.join('reviews', 'metadata.db'));

// Don't care if this fails, that just means the table already exists
db.run('CREATE TABLE reviews (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, owner TEXT NOT NULL)', function (err) { });
	
module.exports = {
	getReviewIndex: function (reviewID, title, description, owner) {
		return new Promise(function (resolve, reject) {
			db.run('INSERT OR IGNORE INTO reviews (id, title, description, owner) VALUES (?, ?, ?, ?)',
				reviewID, title, description, owner, insertDone);
				
			function insertDone(err) {
				if (err) reject(err);
				db.get('SELECT rowid FROM reviews WHERE id = ?', reviewID, getIndexDone);
			}
			
			function getIndexDone(err, row) {
				if (err) reject(err);
				resolve(row.rowid);
			}
		});
	}
};