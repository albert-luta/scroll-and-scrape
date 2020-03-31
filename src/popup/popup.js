const toggleScrollAndScrape = document.querySelector('button[name="toggle-scroll-and-scrape"]');

toggleScrollAndScrape.addEventListener('click', () => {
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		chrome.tabs.sendMessage(tabs[0].id, { toggleScrollAndScrape: true });
	});
});
