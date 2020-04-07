chrome.webRequest.onHeadersReceived.addListener(
	(info) => {
		const headers = info.responseHeaders;
		for (let i = headers.length - 1; i >= 0; --i) {
			const header = headers[i].name.toLowerCase();
			if (header === 'x-frame-options' || header === 'frame-options') {
				headers.splice(i, 1); // Remove header
			}
		}
		return { responseHeaders: headers };
	},
	{
		urls: ['https://www.facebook.com/groups/*'],
		types: ['sub_frame'],
	},
	['blocking', 'responseHeaders']
);

// ----------------------------

const iframe = document.querySelector('iframe');
iframe.addEventListener('load', (e) => {
	// Do stuff
});
