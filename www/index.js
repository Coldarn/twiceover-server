define([
	'util/Util',
	'util/Request'
], function (Util, Request) {
	Request.get('/api/reviews').then(function (response) {
		document.querySelector('.container-inner table').innerHTML = JSON.parse(response)
			.map(function (review) {
				var email = /.*<([^>]+)>.*/.exec(review.owner)[1];
				return `<tr class="review-link">
					<td><a href="twiceover://${location.host}/api/review/${review.ix}">${Util.escapeHtml(review.title)}</a></td>
					<td><a href="/api/reviewsIncluding/${email}">${Util.escapeHtml(review.owner)}</a></td>
					<td>${new Date(review.whenCreated).toDateString()}</td>
					<td>${review.status}</td>
				</tr>`;
			}).join('\n');
	});
});