/* global Promise */
'use strict';

var path = require('path');
var sqlite3 = require('sqlite3');
var Promise = require('bluebird');

var User = require('./user.js');
var config = require('./config.json');

Promise.promisifyAll(sqlite3.Database.prototype);
Promise.promisifyAll(sqlite3.Statement.prototype);

var db = new sqlite3.Database(path.join(config.reviews.path, config.reviews.database));

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
var dbPromise = Promise.settle([
	db.runAsync("CREATE TABLE reviews (ix INTEGER PRIMARY KEY, id TEXT UNIQUE, title TEXT, description TEXT, owner TEXT, "
		+ "created INT, status TEXT NOT NULL)"),
	db.runAsync('ALTER TABLE reviews ADD COLUMN statusLabel TEXT'),
	db.runAsync('ALTER TABLE reviews ADD COLUMN updated INT'),
		
	db.runAsync("CREATE TABLE reviewers (reviewIndex INT NOT NULL, email TEXT NOT NULL COLLATE NOCASE, PRIMARY KEY "
		+ "(reviewIndex, email))"),
	db.runAsync('ALTER TABLE reviewers ADD COLUMN status TEXT'),
	db.runAsync('ALTER TABLE reviewers ADD COLUMN statusLabel TEXT')
]);
	
module.exports = {
	_db: db,			// Exposed ONLY for testing purposes
	_logErrors: true,	// Exposed ONLY for testing purposes
	
	getRecentReviews: function (count) {
		return doNext(function () {
			return db.allAsync('SELECT ix, title, owner, created AS whenCreated, status FROM reviews \
				ORDER BY created DESC LIMIT ?', count || 100);
		});
	},
	
	getReviewIndex: function (reviewIdOrIndex) {
		return doNext(function () {
			return db.getAsync('SELECT ix FROM reviews WHERE ix = ? OR id = ?', reviewIdOrIndex, reviewIdOrIndex)
				.then(function getIndexDone(row) {
					if (!row) throw new Error('Unknown review: ' + reviewIdOrIndex);
					return row.ix;
				});
		});
	},
	
	getOrCreateReview: function (reviewID) {
		return doNext(function () {
			if (typeof reviewID !== 'string' || reviewID.length < 22 || reviewID.length > 23) {
				throw new Error("Invalid review ID: " + reviewID);
			}
			return db.runAsync('INSERT OR IGNORE INTO reviews (id) VALUES (?)', reviewID).then(function insertDone() {
				return db.getAsync('SELECT ix FROM reviews WHERE id = ?', reviewID);
			}).then(function getIX(row) {
				return row.ix;
			});
		});
	},
	
	getReview: function (reviewIdOrIndex) {
		return doNext(function () {
			var review;
			return db.getAsync('SELECT ix, id, title, description, owner, created AS whenCreated, status, statusLabel, 	\
				updated AS whenUpdated FROM reviews WHERE ix = ? OR id = ?', Number(reviewIdOrIndex), reviewIdOrIndex)
				.then(function getDataDone(row) {
					if (!row) throw new Error('No review found: ' + reviewIdOrIndex);
					review = row;
					return db.allAsync('SELECT email as name, status, statusLabel FROM reviewers WHERE reviewIndex = ?', row.ix);
				}).then(function getReviewersDone(rows) {
					review.reviewers = rows;
					return review;				
				});
		});
	},
	
	updateMetadata: function (reviewIdOrIndex, metadata) {
		return doNext(function () {
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
			params.push(Number(reviewIdOrIndex), reviewIdOrIndex);
			return db.runAsync('UPDATE reviews SET ' + sql.join(',') + ' WHERE ix = ? OR id = ?', params);
		});
	},
	
	addReviewers: function (reviewIndex, reviewerEmails) {
		var me = this;
		return doNext(function () {
			return me._addReviewers(reviewIndex, reviewerEmails);
		});
	},
	
	_addReviewers: function (reviewIndex, reviewerEmails) {
		var reviewerEmailsToInsert = reviewerEmails.slice();
		return db.runAsync('BEGIN TRANSACTION')
			.then(function () {
				// Update names for any who's names have been updated
				var statement = db.prepare('UPDATE reviewers SET email = ? 	\
					WHERE reviewIndex = ? AND (email = ? OR email LIKE ?)');
				reviewerEmails.forEach(function (email) {
					var user = User(email);
					statement.run(user.toString(), reviewIndex, user.email, '%<' + user.email + '>%', function (err) {
						if (this.changes) {
							reviewerEmailsToInsert.splice(reviewerEmailsToInsert.indexOf(email), 1);
						}
					});
				});
				return statement.finalizeAsync();
			})
			.then(function () {			
				// Add any new users
				var statement = db.prepare('INSERT OR IGNORE INTO reviewers (reviewIndex, email) VALUES (?, ?)');
				reviewerEmailsToInsert.forEach(function (email) {
					statement.run(reviewIndex, email.trim());
				});
				return statement.finalizeAsync();
			})
			.then(function () {
				return db.runAsync('COMMIT');
			});
	},
	
	updateReviewerStatus: function (reviewIndex, update) {
		var me = this;
		return doNext(function () {
			var user = User(update.name);
			return me._addReviewers(reviewIndex, [user.toString()]).then(function updateStatus() {
				return db.runAsync('UPDATE reviewers SET status = ?, statusLabel = ? 	\
					WHERE reviewIndex = ? AND (email = ? OR email LIKE ?)',
					update.status, update.statusLabel, reviewIndex, user.email, '%<' + user.email + '>%');
			});
		});
	},
	
	getReviewers: function (reviewIndex) {
		return doNext(function () {
			return db.allAsync('SELECT email as name, status, statusLabel FROM reviewers WHERE reviewIndex = ?	\
				ORDER BY rowid ASC', reviewIndex);
		});
	},
	
	getReviewsIncludingReviewer: function (email) {
		return doNext(function () {
			return db.allAsync('SELECT ix, title, owner, created AS whenCreated, status, statusLabel FROM reviews	\
				WHERE owner LIKE ?																					\
				OR ix IN (SELECT reviewIndex FROM reviewers WHERE email = ?)										\
				ORDER BY created DESC LIMIT 1000', '%<' + email + '>%', email);
		});
	},
	
	getReviewsExcludingReviewer: function (email) {
		return doNext(function () {
			return db.allAsync('SELECT ix, title, owner, created AS whenCreated, status, statusLabel FROM reviews	\
				WHERE owner NOT LIKE ?																				\
				AND ix NOT IN (SELECT reviewIndex FROM reviewers WHERE email = ?)									\
				ORDER BY created DESC LIMIT 1000', '%<' + email + '>%', email);
		});
	}
};

function doNext(fn) {
	var p = dbPromise.then(fn);
	dbPromise = p.catch(function (err) {
		if (module.exports._logErrors) {
			console.error(err.stack ? err.stack : err);
		}
	});
	return p;
}