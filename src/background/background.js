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

const FB_GROUPS_PERIOD = 15;

const iframe = document.querySelector('iframe');
iframe.addEventListener('load', (e) => {
	// Do stuff
});

chrome.alarms.create('fb-groups', { when: Date.now() + 100, periodInMinutes: FB_GROUPS_PERIOD });
chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === 'fb-groups') console.log('fb-groups alarm');
});
