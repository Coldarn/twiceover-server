/* global Promise */
'use strict';

var path = require('path');
var sqlite3 = require('sqlite3');

var db = new sqlite3.Database(path.join('reviews', 'reviews.db'));

var updateColumns = {
	title: 'title',
	description: 'description',
	owner: 'owner',
	whenCreated: 'created',
	status: 'status'	
};

// Don't care if any of these fail, that just means the tables already exists
db.run("CREATE TABLE reviews (ix INTEGER PRIMARY KEY, id TEXT UNIQUE, title TEXT, description TEXT, owner TEXT,"
	+ "created INT, status TEXT NOT NULL DEFAULT 'active')", function (err) { });
db.run('CREATE TABLE reviewers (reviewIndex INT NOT NULL, email TEXT NOT NULL COLLATE NOCASE, PRIMARY KEY (reviewIndex, email))', function (err) { });
	
module.exports = {
	getRecentReviews: function () {
		return new Promise(function (resolve, reject) {
			db.all('SELECT ix, title, owner, created, status FROM reviews ORDER BY created DESC LIMIT 1000', getDataDone);
			function getDataDone(err, rows) {
				if (err) reject(err);
				resolve(rows);
			}
		});
	},
	
	getReviewIndex: function (reviewIdOrIndex) {
		return new Promise(function (resolve, reject) {
				db.get('SELECT ix FROM reviews WHERE ix = ? OR id = ?',
					reviewIdOrIndex, reviewIdOrIndex, getIndexDone);
			
			function getIndexDone(err, row) {
				if (err) return reject(err);
				if (!row) return reject('Unknown review: ' + reviewIdOrIndex);
				resolve(row.ix);
			}
		});
	},
	
	getOrCreateReview: function (reviewID) {
		var me = this;
		
		return new Promise(function (resolve, reject) {
			db.run('INSERT OR IGNORE INTO reviews (id) VALUES (?)', reviewID, insertDone);
				
			function insertDone(err) {
				if (err) reject(err);
				resolve(me.getReviewIndex(reviewID));
			}
		});
	},
	
	getReview: function (reviewIndex) {
		return new Promise(function (resolve, reject) {
			var review;
			
			db.get('SELECT ix, id, title, description, owner, created, status FROM reviews'
				+ ' WHERE ix = ?', reviewIndex, getDataDone);
				
			function getDataDone(err, row) {
				if (err) reject(err);
				review = row;
				db.all('SELECT email FROM reviewers WHERE reviewIndex = ?', reviewIndex, getReviewersDone);
			}
			function getReviewersDone(err, rows) {
				if (err) reject(err);
				review.reviewers = rows.map(function (r) { return r.email; });
				resolve(review);				
			}
		});
	},
	
	updateMetadata: function (reviewIdOrIndex, metadata) {
		var sql = [],
			params = [];
		Object.keys(metadata).forEach(function (key) {
			if (!(key in updateColumns)) {
				throw new Error('Unknown metadata key: ' + key);
			}
			sql.push(updateColumns[key] + ' = ?');
			params.push(metadata[key]);
		});
		if (sql.length === 0) {
			throw new Error('No metadata given to update!');
		}
		params.push(reviewIdOrIndex, reviewIdOrIndex);
		db.run('UPDATE reviews SET ' + sql.join(',') + ' WHERE ix = ? OR id = ?', params);
	},
	
	addReviewers: function (reviewIndex, reviewerEmails) {
		db.serialize(function () {
			db.run('BEGIN TRANSACTION');
			var statement = db.prepare('INSERT OR IGNORE INTO reviewers (reviewIndex, email) VALUES (?, ?)');
			reviewerEmails.forEach(function (email) {
				statement.run(reviewIndex, email.trim());
			});
			statement.finalize();
			db.run('COMMIT');
		});
	},
	
	getReviewsByReviewer: function (email) {
		return new Promise(function (resolve, reject) {
			db.all('SELECT ix, title, owner, created, status FROM reviews'
				+ ' WHERE owner LIKE ?'
				+ ' OR ix IN (SELECT ix FROM reviewers WHERE email = ?)'
				+ ' ORDER BY created DESC LIMIT 1000', '%<' + email + '>%', email, getDataDone);
			function getDataDone(err, rows) {
				if (err) reject(err);
				resolve(rows);
			}
		});
	}
};