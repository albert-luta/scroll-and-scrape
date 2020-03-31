const toggleScroll = document.querySelector('button[name="toggle-scroll"]');

toggleScroll.addEventListener('click', () => {
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		chrome.tabs.sendMessage(tabs[0].id, { toggleScroll: true });
	});
});
