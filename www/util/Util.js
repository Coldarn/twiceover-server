define(function () {
	'use strict';
	
    const htmlEscapeEl = document.createElement('div');
    const textEscapeEl = document.createTextNode('');
	htmlEscapeEl.appendChild(textEscapeEl);

    var highResTimeBase = Date.now() - performance.now();

	var Util = {
        escapeHtml: function (html) {
            textEscapeEl.nodeValue = html;
            return htmlEscapeEl.innerHTML;
        },
		highResTime: function () {
			return highResTimeBase + performance.now();
		}
	};
	return Util;
});