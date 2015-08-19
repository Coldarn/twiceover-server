define([
	'util/Util',
	'util/Request'
], function (Util, Request) {
	Request.get('/api/reviews').then(function (response) {
		document.querySelector('.container-inner table').innerHTML = JSON.parse(response)
			.map(function (review) {
				return `<tr class="review-link">
					<td><a href="twiceover://${location.host}/api/review/${review.ix}">${Util.escapeHtml(review.title)}</a></td>
					<td>${Util.escapeHtml(review.owner)}</td>
					<td>${new Date(review.created).toDateString()}</td>
					<td>${review.status}</td>
				</tr>`;
			}).join('\n');
	});
});