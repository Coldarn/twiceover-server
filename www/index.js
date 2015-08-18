define([
	'util/Request'
], function (Request) {
	Request.get('/api/reviews').then(function (response) {
		document.querySelector('.container-inner ul').innerHTML = JSON.parse(response)
			.map(function (review) {
				return `<li class="review-link"><a href="twiceover://${location.host}/api/review/${review.rowid}">${review.title}</a></li>`;
			}).join('\n');
	});
});