// chrome.webRequest.onHeadersReceived.addListener(
// 	(info) => {
// 		const headers = info.responseHeaders;
// 		for (let i = headers.length - 1; i >= 0; --i) {
// 			const header = headers[i].name.toLowerCase();
// 			if (header === 'x-frame-options' || header === 'frame-options') {
// 				headers.splice(i, 1); // Remove header
// 			}
// 		}
// 		return { responseHeaders: headers };
// 	},
// 	{
// 		urls: ['https://www.facebook.com/groups/*'],
// 		types: ['sub_frame'],
// 	},
// 	['blocking', 'responseHeaders']
// );

// ----------------------------

// const FB_GROUPS_PERIOD = 15;

// const iframe = document.querySelector('iframe');
// iframe.addEventListener('load', (e) => {
// 	// Do stuff
// });

// chrome.alarms.create('fb-groups', { when: Date.now() + 100, periodInMinutes: FB_GROUPS_PERIOD });
// chrome.alarms.onAlarm.addListener((alarm) => {
// 	if (alarm.name === 'fb-groups') console.log('fb-groups alarm');
// });

// ----------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
		// Checks to see if the active tab is on a facebook group
		if (tabs[0].url.startsWith('https://www.facebook.com/groups')) {
			// If the btn pressed was stop, don't redirect
			if (request.stop) {
				chrome.tabs.sendMessage(tabs[0].id, request);
				return;
			}

			// Checks to see if the group is set to show the posts in a chronological order
			if (tabs[0].url.includes('sorting_setting=CHRONOLOGICAL')) {
				chrome.tabs.sendMessage(tabs[0].id, request);
			}
			// If not, redirects to the same group, but with chronological order setting checked on
			else {
				chrome.tabs.update(
					tabs[0].id,
					{
						active: true,
						url: `${tabs[0].url}${
							tabs[0].url.includes('?') ? '&' : '?'
						}sorting_setting=CHRONOLOGICAL`,
					},
					(tab) => {
						// Waits for the page to load the initial render(and mainly the feed element)
						const listener = chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
							if (tabId === tab.id && changeInfo.status === 'complete') {
								// Removes the listener to not trigger on every page load, but only once
								chrome.tabs.onUpdated.removeListener(listener);
								chrome.tabs.sendMessage(tabId, request);
							}
						});
					}
				);
			}
		} else {
			chrome.tabs.sendMessage(tabs[0].id, { error: 'This is not a facebook group' });
		}
	});
});
