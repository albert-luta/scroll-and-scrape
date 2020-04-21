// Instead of groupsUrls, we can modify it to groupsParams and just pass the params => make a function that constructs the url already chron ordered

/**
 * The interval for the scraping alarms (in minutes)
 */
const FB_GROUPS_PERIOD_MINUTES = 1;

/**
 * Urls of the groups to scrape; should be initialized, but NOT changed afterwards
 */
const groupsUrls = [
	'https://www.facebook.com/groups/alljavascript?sorting_setting=CHRONOLOGICAL',
	'https://www.facebook.com/groups/434902823744100',
];

/**
 * The minimized window in which all groups are loaded in different tabs
 */
let scraperWindowId = null;

/**
 * Detects when the 'scraping' window closed, either by pressing the stop button, or all tabs finished scraping
 */
chrome.windows.onRemoved.addListener((removedWindowId) => {
	if (scraperWindowId == null || removedWindowId !== scraperWindowId) return;

	console.log(`Window closed with id: ${scraperWindowId}`);
	scraperWindowId = null;
});

/**
 * Listener for the scraping alarm
 */
chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name !== 'fb-groups_alarm') return;

	if (scraperWindowId != null) {
		console.log('Window already opened, alarm is not triggered this time');
		return;
	}

	console.log('Scraping alarm triggered');
	chrome.windows.create(
		{
			url: groupsUrls,
			state: 'minimized',
		},
		(window) => {
			console.log(`Window created with id: ${window.id}`);
			scraperWindowId = window.id;

			window.tabs.forEach((tab) => {
				sendStartMessage(tab);
			});
		}
	);
});

/**
 * Listens for the message from popup or content
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	// Handles the message from popup to start scraping
	if (request.start) {
		chrome.alarms.get('fb-groups_alarm', (alarm) => {
			if (alarm) {
				console.log('Scraping is already active');
				return;
			}

			console.log('Scraping started');

			chrome.alarms.create('fb-groups_alarm', {
				when: Date.now(),
				periodInMinutes: FB_GROUPS_PERIOD_MINUTES,
			});
		});
	}
	// Handles the message from popup to stop scraping
	else if (request.stop) {
		chrome.alarms.get('fb-groups_alarm', (alarm) => {
			if (!alarm) {
				console.log('Scraping is already stopped');
				return;
			}

			chrome.alarms.clear('fb-groups_alarm', () => {
				console.log('Scraping alarm was cleared');

				if (scraperWindowId != null) {
					chrome.windows.remove(scraperWindowId);
				}

				console.log('Scraping stopped');
			});
		});
	}
	// Handles the messages from content(with new posts data)
	else if (request.groupParam) {
		const { groupParam, newPosts } = request;

		chrome.tabs.remove(sender.tab.id, () => {
			console.log(`Tab for ${groupParam} finished its job and was closed`);
		});

		if (newPosts) {
			console.log(`New posts received from ${groupParam}`);
			updateGroupPosts(groupParam, newPosts);
		} else {
			console.log(`No new posts received from ${groupParam}`);
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
 * @param {Object} tab - The tab object with all the informations
 */
function sendStartMessage(tab) {
	const groupParam = getFbGroupParam(tab.pendingUrl);
	const lastPost = getLastPost(groupParam);
	const options = { start: true, groupParam, lastPost };

	// Format to correct url(chronological ordered)
	const formattedUrl = formatUrl(tab.pendingUrl);

	// The case when the page is not chronologicaly ordered
	if (tab.pendingUrl !== formattedUrl) {
		console.log(
			`Need to update the url for the page to be chronologicaly ordered for ${tab.pendingUrl}`
		);

		// Refresh the page and send the start message
		chrome.tabs.update(
			tab.id,
			{
				url: formattedUrl,
			},
			(tab) => {
				// Waits for the page to load the initial render(and mainly the feed element)
				chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
					if (tabId === tab.id && changeInfo.status === 'complete') {
						// Removes the listener to not trigger on every page load, but only once
						chrome.tabs.onUpdated.removeListener(listener);

						chrome.tabs.sendMessage(tabId, options);
						console.log(`Start scraping message was sent to ${groupParam}`);
					}
				});
			}
		);
	}
	// The case when the page is chronologicaly ordered
	else {
		console.log(`Url is ok for the page to be chronologicaly ordered for ${tab.pendingUrl}`);

		// Waits for the page to load the initial render(and mainly the feed element)
		chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
			if (tabId === tab.id && changeInfo.status === 'complete') {
				// Removes the listener to not trigger on every page load, but only once
				chrome.tabs.onUpdated.removeListener(listener);

				chrome.tabs.sendMessage(tabId, options);
				console.log(`Start scraping message was sent to ${groupParam}`);
			}
		});
	}
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
