/**
 * The interval for the alarms(in minutes)
 */
const FB_GROUPS_PERIOD_MINUTES = 1;

/**
 * Stores the references of the alarms listeners
 */
const activeAlarmListeners = {};

/**
 * Listens for the popup messages
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	// Handles start and stop messages received from popup
	if (request.start || request.stop) {
		chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
			// Checks to see if the active tab is on a facebook group
			if (tabs[0].url.startsWith('https://www.facebook.com/groups')) {
				const groupParam = getFbGroupParam(tabs[0].url);
				const groupAlarmString = `fb-group_${groupParam}_alarm`;

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
						// Creates a new unique listener for that group's alarm, so you can reference it later, when you want to remove it along with the alarm
						const alarmListener = (alarm) => {
							if (alarm.name === groupAlarmString) {
								console.log(`Alarm triggered on ${groupParam}`);

								sendStartMessage(tabs, groupParam);
							}
						};
						chrome.alarms.onAlarm.addListener(alarmListener);
						activeAlarmListeners[groupAlarmString] = alarmListener;
					});
				} else if (request.stop) {
					chrome.alarms.get(groupAlarmString, (alarm) => {
						if (!alarm) {
							console.log(`No alarm is set on ${groupParam}`);
							return;
						}

						chrome.alarms.clear(groupAlarmString, () => {
							console.log(`Alarm on ${groupParam} was cleared`);
							sendStopMessage(tabs);
						});
						chrome.alarms.onAlarm.removeListener(
							activeAlarmListeners[groupAlarmString]
						);
						delete activeAlarmListeners[groupAlarmString];
					});
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

		if (newPosts) {
			console.log(`${groupParam}: New posts received`);
			updateGroupPosts(groupParam, newPosts);
		} else {
			console.log(`${groupParam}: No new posts received`);
		}
	}
	// Handles the message from content(when it coudn't locate the feed element)
	else if (request.couldntLocateFeed) {
		console.log(`Couldn't locate the feed element for ${request.groupParam}`);
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
	const lastPost = getLastPost(groupParam);
	const options = { start: true, groupParam, lastPost };

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
function sendStopMessage(tabs) {
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
 * Gets the newest post of a specific group posts, if the group wasn't scraped yet, returns an obj with the timestamp set(last x day), but the others null
 * @param {String} group - Fb group's param
 * @param {Number} daysToScrape - If there are no previous posts, how many days to scrape the group in the past
 * @returns {Object} The last post info for that specific group
 */
function getLastPost(group, daysToScrape = 5) {
	const data = JSON.parse(localStorage.getItem(`fb-group_${group}_posts`));
	let lastPost;

	if (!data) {
		// If there is no record for a specific group, scrape the last x days
		const timestamp = new Date().setDate(new Date().getDate() - daysToScrape);

		lastPost = { timestamp, author: null, message: null };
	} else {
		const { timestamp, author, message } = data[0];

		lastPost = { timestamp, author, message };
	}

	return lastPost;
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
		localStorage.setItem(groupPostsString, JSON.stringify([...newPosts, ...oldPosts]));
	}

	console.log(`${group}'s posts were updated with:`);
	console.table(newPosts);

	console.log(`${group}'s total posts are:`);
	console.table(JSON.parse(localStorage.getItem(groupPostsString)));
}
