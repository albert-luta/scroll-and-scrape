const startScraping = document.querySelector('button[name="scroll-and-scrape"]');

/**
 * Listens for click event on the 'start scraping' button and sends to the content script(active one) the correct message, depending on the page it is on
 */
startScraping.addEventListener('click', () => {
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		// Checks to see if the active tab is on a facebook group
		if (tabs[0].url.startsWith('https://www.facebook.com/groups')) {
			// Checks to see if the group is set to show the posts in a chronological order
			if (tabs[0].url.includes('sorting_setting=CHRONOLOGICAL')) {
				chrome.tabs.sendMessage(tabs[0].id, { startScraping: true });
			}
			// If not, redirects to the same group, but with chronological order setting checked on
			else {
				chrome.tabs.update(
					tabs[0].id,
					{
						active: true,
						url: `${tabs[0].url}${
							tabs[0].url.includes('?') ? '&' : '?'
						}sorting_setting=CHRONOLOGICAL`
					},
					(tab) => {
						// Waits for the page to load the initial render(and mainly the feed element)
						const listener = chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
							if (tabId === tab.id && changeInfo.status === 'complete') {
								// Removes the listener to not trigger on every page load, but only once
								chrome.tabs.onUpdated.removeListener(listener);
								chrome.tabs.sendMessage(tabId, { startScraping: true });
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
