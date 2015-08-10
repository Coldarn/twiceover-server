define([
	'util/request'
], function (Request) {
	Request.get('/api/reviews').then(function (response) {
		document.querySelector('.container-inner ul').innerHTML = JSON.parse(response)
			.map(function (name) {
				return `<li class="review-link"><a href="/api/review/${name}">${name}</a></li>`;
			}).join('\n');
	});
});