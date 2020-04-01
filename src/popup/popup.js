const startScraping = document.querySelector('button[name="scroll-and-scrape"]');

startScraping.addEventListener('click', () => {
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		if (tabs[0].url.startsWith('https://www.facebook.com/groups')) {
			if (tabs[0].url.includes('sorting_setting=CHRONOLOGICAL')) {
				chrome.tabs.sendMessage(tabs[0].id, { startScraping: true });
			} else {
				chrome.tabs.update(
					tabs[0].id,
					{
						active: true,
						url: `${tabs[0].url}${
							tabs[0].url.includes('?') ? '&' : '?'
						}sorting_setting=CHRONOLOGICAL`
					},
					(tab) => {
						const listener = chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
							if (tabId === tab.id && changeInfo.status === 'complete') {
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
