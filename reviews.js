/* global Promise */
'use strict';

var path = require('path');
var sqlite3 = require('sqlite3');

var User = require('./user.js');

var db = new sqlite3.Database(path.join('reviews', 'reviews.db'));

var updateColumns = {
	title: 'title',
	description: 'description',
	owner: 'owner',
	whenCreated: 'created',
	status: 'status',
	statusLabel: 'statusLabel',
	whenUpdated: 'updated'
};

// Don't care if any of these fail, that just means they've already been run
db.run("CREATE TABLE reviews (ix INTEGER PRIMARY KEY, id TEXT UNIQUE, title TEXT, description TEXT, owner TEXT, "
	+ "created INT, status TEXT NOT NULL)", function (err) { });
db.run('ALTER TABLE reviews ADD COLUMN statusLabel TEXT', function (err) { });
db.run('ALTER TABLE reviews ADD COLUMN updated INT', function (err) { });
	
db.run("CREATE TABLE reviewers (reviewIndex INT NOT NULL, email TEXT NOT NULL COLLATE NOCASE, PRIMARY KEY "
	+ "(reviewIndex, email))", function (err) { });
db.run('ALTER TABLE reviewers ADD COLUMN status TEXT', function (err) { });
db.run('ALTER TABLE reviewers ADD COLUMN statusLabel TEXT', function (err) { });
	
module.exports = {
	getRecentReviews: function () {
		return new Promise(function (resolve, reject) {
			db.all('SELECT ix, title, owner, created AS whenCreated, status FROM reviews ORDER BY created DESC LIMIT 1000', getDataDone);
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
	
	getReview: function (reviewIdOrIndex) {
		return new Promise(function (resolve, reject) {
			var review;
			
			db.get('SELECT ix, id, title, description, owner, created AS whenCreated, status, statusLabel, updated AS whenUpdated FROM reviews'
				+ ' WHERE ix = ? OR id = ?', Number(reviewIdOrIndex), reviewIdOrIndex, getDataDone);
				
			function getDataDone(err, row) {
				if (err) return reject(err);
				if (!row) return reject('No review found: ' + reviewIdOrIndex);
				review = row;
				db.all('SELECT email as name, status, statusLabel FROM reviewers WHERE reviewIndex = ?', row.ix, getReviewersDone);
			}
			function getReviewersDone(err, rows) {
				if (err) return reject(err);
				review.reviewers = rows;
				resolve(review);				
			}
		});
	},
	
	updateMetadata: function (reviewIdOrIndex, metadata) {
		return new Promise(function (resolve, reject) {
			var sql = [],
				params = [];
			Object.keys(metadata).forEach(function (key) {
				if (updateColumns[key]) {
					sql.push(updateColumns[key] + ' = ?');
					params.push(metadata[key]);
				}
			});
			if (sql.length === 0) {
				throw new Error('No metadata given to update!');
			}
			params.push(reviewIdOrIndex, reviewIdOrIndex);
			db.run('UPDATE reviews SET ' + sql.join(',') + ' WHERE ix = ? OR id = ?', params, function (err) {
				if (err) return reject(err);
				resolve();
			});
		});
	},
	
	addReviewers: function (reviewIndex, reviewerEmails) {
		return new Promise(function (resolve, reject) {
			function checkErr(err) {
				if (err) return reject(err);
			}
			db.serialize(function () {
				db.run('BEGIN TRANSACTION');
				
				// Update names for any who's names have been updated
				var updateStmt = db.prepare('UPDATE reviewers SET email = ? WHERE reviewIndex = ? AND email = ?');
				reviewerEmails.forEach(function (email) {
					var user = User(email);
					updateStmt.run(user.toString(), reviewIndex, user.email, checkErr);
				});
				updateStmt.finalize();
				
				// Add any new users
				var insertStmt = db.prepare('INSERT OR IGNORE INTO reviewers (reviewIndex, email) VALUES (?, ?)');
				reviewerEmails.forEach(function (email) {
					insertStmt.run(reviewIndex, email.trim(), checkErr);
				});
				insertStmt.finalize();
				
				db.run('COMMIT', function (err) {
					if (err) return reject(err);
					resolve();
				});
			});
		});
	},
	
	updateReviewerStatus: function (reviewIndex, reviewer, status, statusLabel) {
		return new Promise(function (resolve, reject) {
			var user = User(reviewer);
			if (user.name) {
				db.run('UPDATE reviewers SET email = ? WHERE reviewIndex = ? AND email = ?',
					user.toString(), reviewIndex, user.email, updateNameDone);
			} else {
				updateNameDone();
			}
			function updateNameDone(err) {
				if (err) return reject(err);
				db.run('UPDATE reviewers SET status = ?, statusLabel = ? WHERE reviewIndex = ? AND email = ?',
					status, statusLabel, reviewIndex, reviewer, updateStatusDone);
			}
			function updateStatusDone(err) {
				if (err) return reject(err);
				resolve();
			}
		});
	},
	
	getReviewsIncludingReviewer: function (email) {
		return new Promise(function (resolve, reject) {
			db.all('SELECT ix, title, owner, created AS whenCreated, status, statusLabel FROM reviews'
				+ ' WHERE owner LIKE ?'
				+ ' OR ix IN (SELECT reviewIndex FROM reviewers WHERE email = ?)'
				+ ' ORDER BY created DESC LIMIT 1000', '%<' + email + '>%', email, getDataDone);
			function getDataDone(err, rows) {
				if (err) reject(err);
				resolve(rows);
			}
		});
	},
	
	getReviewsExcludingReviewer: function (email) {
		return new Promise(function (resolve, reject) {
			db.all('SELECT ix, title, owner, created AS whenCreated, status, statusLabel FROM reviews'
				+ ' WHERE owner NOT LIKE ?'
				+ ' AND ix NOT IN (SELECT reviewIndex FROM reviewers WHERE email = ?)'
				+ ' ORDER BY created DESC LIMIT 1000', '%<' + email + '>%', email, getDataDone);
			function getDataDone(err, rows) {
				if (err) reject(err);
				resolve(rows);
			}
		});
	}
};