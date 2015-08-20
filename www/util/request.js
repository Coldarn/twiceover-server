define([], function () {
	'use strict';

	function Request(method, url) {
		var req = new XMLHttpRequest();
		req.open(method, url, true);
		return new Promise(function (resolve, reject) {
			req.onreadystatechange = function () {
				if (req.readyState === 4) {
					if (req.status === 200) {
						resolve(req.response);
					} else {
						reject(req);
					}
				}
			};
			req.send();
		});
	}
	
	return {
		get: function (url) {
			url = `${url}${url.indexOf('?') >= 0 ? '&' : '?'}_dc=${Date.now()}`;
			return Request('GET', url);
		}
	};
});