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
	// Handles start and stop messages received from popup
	if (request.start || request.stop) {
		chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
			// Checks to see if the active tab is on a facebook group
			if (tabs[0].url.startsWith('https://www.facebook.com/groups')) {
				// If the btn pressed was stop, don't redirect
				if (request.stop) {
					chrome.tabs.sendMessage(tabs[0].id, request);
					return;
				}

				// Initialize config options and localstorage to begin scraping a group
				const groupParam = getFbGroupParam(tabs[0].url);
				if (isGroupAlreadyInScraping(groupParam)) return;

				const lastTimestamp = getLastTimestamp(groupParam);
				setGroupScrapingActive(groupParam);
				const options = { ...request, lastTimestamp, groupParam };

				// Checks to see if the group is set to show the posts in a chronological order
				let url;
				if (tabs[0].url.includes('sorting_setting=CHRONOLOGICAL')) {
					url = tabs[0].url;
				} else {
					url = `${tabs[0].url}${
						tabs[0].url.includes('?') ? '&' : '?'
					}sorting_setting=CHRONOLOGICAL`;
				}
				chrome.tabs.update(
					tabs[0].id,
					{
						active: true,
						url,
					},
					(tab) => {
						// Waits for the page to load the initial render(and mainly the feed element)
						chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
							if (tabId === tab.id && changeInfo.status === 'complete') {
								// Removes the listener to not trigger on every page load, but only once
								chrome.tabs.onUpdated.removeListener(listener);
								console.log('Start message sent');
								chrome.tabs.sendMessage(tabId, options);
							}
						});
					}
				);
			} else {
				chrome.tabs.sendMessage(tabs[0].id, { error: 'This is not a facebook group' });
			}
		});
	}
	// Handles the messages from content(with new posts data)
	else if (request.groupParam && request.newPosts) {
		const { groupParam, newPosts } = request;
		setGroupScrapingInactive(groupParam);
		updateGroupPosts(groupParam, newPosts);
	}
});

/**
 * Gets the fb group's unique param from an url
 * @param {String} url - The fb group url you want to get the param from
 * @returns {String} The fb group's unique param
 */
function getFbGroupParam(url) {
	return url.slice(8).split('/')[2].split('?')[0];
}

/**
 * Gets the newest timestamp of a specific group posts, if the group wasn't scraped yet, returns the timestamp of the last x day
 * @param {String} group - Fb group's param
 * @returns {Timestamp} The timestamp of the the newest post on a specific group
 */
function getLastTimestamp(group) {
	const data = JSON.parse(localStorage.getItem(`fb-group_${group}_posts`));
	if (!data) {
		// If there is no record for a specific group, scrape the last x days
		return new Date().setDate(new Date().getDate() - 5);
	} else {
		return data[0].timestamp;
	}
}

function setGroupScrapingActive(group) {
	localStorage.setItem(`fb-group_${group}_isActive`, 'true');
}

function setGroupScrapingInactive(group) {
	localStorage.setItem(`fb-group_${group}_isActive`, 'false');
}

function updateGroupPosts(group, newPosts) {
	if (!newPosts.length) return;

	const groupPostsString = `fb-group_${group}_posts`;
	const oldPosts = JSON.parse(localStorage.getItem(groupPostsString));

	if (!oldPosts) {
		localStorage.setItem(groupPostsString, JSON.stringify(newPosts));
	} else {
		if (isTheSamePost(newPosts[newPosts.length - 1], oldPosts[0])) newPosts.pop();

		localStorage.setItem(groupPostsString, JSON.stringify([...newPosts, ...oldPosts]));
	}
}

// !!! Checks just shallow
function isTheSamePost(a, b) {
	if (Object.keys(a).length !== Object.keys(b).length) return false;
	if (!checkSameKeys(a, b)) return false;
	// Just author and message(if it is not edited) can remain the same -> better would be to check the author and the timestamp to be close one to another
	if (a.author !== b.author || a.message !== b.message) return false;

	return true;
}

function checkSameKeys(a, b) {
	// Object.keys arrays can be in different order
	const keys1 = Object.keys(a).sort();
	const keys2 = Object.keys(b).sort();

	return keys1.every((key, i) => key === keys2[i]);
}

function isGroupAlreadyInScraping(group) {
	return JSON.parse(localStorage.getItem(`fb-group_${group}_isActive`));
}
