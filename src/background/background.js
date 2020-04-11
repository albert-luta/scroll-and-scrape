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

// const iframe = document.querySelector('iframe');
// iframe.addEventListener('load', (e) => {
// 	// Do stuff
// });

// ----------------------------

const FB_GROUPS_PERIOD_MINUTES = 1;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	// Handles start and stop messages received from popup
	if (request.start || request.stop) {
		chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
			// Checks to see if the active tab is on a facebook group
			if (tabs[0].url.startsWith('https://www.facebook.com/groups')) {
				const groupParam = getFbGroupParam(tabs[0].url);
				const groupAlarmString = `fb-group_${groupParam}`;

				if (request.start) {
					chrome.alarms.get(groupAlarmString, (alarm) => {
						// Don't create another alarm + listener if it already exists on a specific group
						if (alarm) {
							console.log(`Alarm already exists on ${groupParam}`);
							return;
						}

						chrome.alarms.create(groupAlarmString, {
							when: Date.now(),
							periodInMinutes: FB_GROUPS_PERIOD_MINUTES,
						});
						chrome.alarms.onAlarm.addListener((alarm) => {
							if (alarm.name === groupAlarmString) {
								console.log(`Alarm triggered on ${groupParam}`);

								sendStartMessage(tabs, groupParam);
							}
						});
					});

					// sendStartMessage(tabs, groupParam);
				} else if (request.stop) {
					chrome.alarms.clear(groupAlarmString, () => {
						console.log(`Alarm on ${groupParam} was cleared`);
						sendStopMessage(tabs, groupParam);
					});

					// sendStopMessage(tabs, groupParam);
				}
			} else {
				chrome.tabs.sendMessage(tabs[0].id, { error: 'This is not a facebook group' });
				console.log('Not a fb group');
			}
		});
	}
	// Handles the messages from content(with new posts data)
	else if (request.groupParam) {
		const { groupParam, newPosts } = request;

		setGroupScrapingInactive(groupParam);
		if (newPosts) {
			console.log(`${groupParam}: New posts received`);
			updateGroupPosts(groupParam, newPosts);
		} else {
			console.log(`${groupParam}: No new posts received`);
		}
	}
	// Fallback, if it doesn't recognize the message
	else {
		console.log('Unknown behavior');
	}
});

/**
 * Send the message to the content to start the scraping
 */
function sendStartMessage(tabs, groupParam) {
	// Don't sent the start message if it's already running
	if (isGroupAlreadyInScraping(groupParam)) {
		console.log(`Scraping is already running on ${groupParam}, no messages were sent`);
		return;
	}

	setGroupScrapingActive(groupParam);
	const lastTimestamp = getLastTimestamp(groupParam);
	const options = { start: true, lastTimestamp, groupParam };

	// Format to correct url(chronological ordered)
	const url = formatUrl(tabs[0].url);

	// Refresh the page and send the start message
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

					chrome.tabs.sendMessage(tabId, options);
					console.log('Start scraping message was sent');
				}
			});
		}
	);
}

/**
 * Send the message to the content to stop the scraping
 */
function sendStopMessage(tabs, groupParam) {
	if (!isGroupAlreadyInScraping(groupParam)) {
		console.log(`Scraping is already stopped on ${groupParam}, no messages were sent`);
		return;
	}

	setGroupScrapingInactive(groupParam);

	chrome.tabs.sendMessage(tabs[0].id, { stop: true });
	console.log('Stop scraping message was sent');
}

/**
 * Receives a fb group url and returns it formatted(chronological ordered)
 * @param {String} url - The url string to be formatted
 * @returns {String} The url formatted
 */
function formatUrl(url) {
	if (url.includes('sorting_setting=CHRONOLOGICAL')) {
		return url;
	} else {
		return `${url}${url.includes('?') ? '&' : '?'}sorting_setting=CHRONOLOGICAL`;
	}
}

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

/**
 * Sets the localstorage's isActive to true associated with that group
 * @param {String} group - Fb group's param
 */
function setGroupScrapingActive(group) {
	localStorage.setItem(`fb-group_${group}_isActive`, 'true');
}

/**
 * Sets the localstorage's isActive to false associated with that group
 * @param {String} group - Fb group's param
 */
function setGroupScrapingInactive(group) {
	localStorage.setItem(`fb-group_${group}_isActive`, 'false');
}

/**
 * Updates the localstorage with new posts
 * @param {String} group - Fb group's param
 * @param {Array<Object>} newPosts - The new posts received from scraping
 */
function updateGroupPosts(group, newPosts) {
	if (!newPosts.length) {
		console.log(`${group}: Empty new posts`);
		return;
	}

	const groupPostsString = `fb-group_${group}_posts`;
	const oldPosts = JSON.parse(localStorage.getItem(groupPostsString));

	if (!oldPosts) {
		localStorage.setItem(groupPostsString, JSON.stringify(newPosts));
	} else {
		if (isTheSamePost(newPosts[newPosts.length - 1], oldPosts[0])) newPosts.pop();

		localStorage.setItem(groupPostsString, JSON.stringify([...newPosts, ...oldPosts]));
	}

	console.log(`${group}'s posts were updated with:`);
	console.table(newPosts.length ? newPosts : null);

	console.log(`${group}'s total posts are:`);
	console.table(JSON.parse(localStorage.getItem(groupPostsString)));
}

/**
 * Checks to see if it is the exact same post
 * @param {Object} a - Post a
 * @param {Object} b - Post b
 * @returns {Boolean}
 */
// !!! Checks just shallow
function isTheSamePost(a, b) {
	if (Object.keys(a).length !== Object.keys(b).length) return false;
	if (!checkSameKeys(a, b)) return false;
	// Just author and message(if it is not edited) can remain the same -> better would be to check the author and the timestamp to be close one to another
	if (a.author !== b.author || a.message !== b.message) return false;

	return true;
}

/**
 * Checks to see if 2 objects have the same keys(or 1 is included into another)
 * @param {Object} a - Object a
 * @param {Object} b - Object b
 * @returns {Boolean}
 */
function checkSameKeys(a, b) {
	// Object.keys arrays can be in different order
	const keys1 = Object.keys(a).sort();
	const keys2 = Object.keys(b).sort();

	return keys1.every((key, i) => key === keys2[i]);
}

/**
 * Checks to see if the group is already in the scraping proces
 * @param {String} group - Fb group's param
 * @returns {Boolean}
 */
function isGroupAlreadyInScraping(group) {
	return JSON.parse(localStorage.getItem(`fb-group_${group}_isActive`));
}
