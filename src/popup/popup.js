const form = document.querySelector('form');
const startBtn = 'start';
const stopBtn = 'stop';

// Start scraping
form[startBtn].addEventListener('click', () => {
	chrome.runtime.sendMessage({ start: true });
});

// Stop scraping
form[stopBtn].addEventListener('click', () => {
	chrome.runtime.sendMessage({ stop: true });
});
