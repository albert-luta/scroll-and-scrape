'use strict';

let scroll = {
	isActive: false,
	interval: null
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.toggleScroll) {
		toggleScroll(scroll);
	}
});

function toggleScroll(scroll) {
	if (!scroll.isActive) {
		startScrolling(scroll);
	} else {
		stopScrolling(scroll);
	}
}

function startScrolling(scroll) {
	scroll.isActive = true;

	let scrollPosition = window.pageYOffset;
	scroll.interval = setInterval(() => {
		if (scrollPosition < document.body.clientHeight - window.innerHeight) {
			scrollPosition = document.body.clientHeight - window.innerHeight;
			window.scroll({
				top: scrollPosition
			});
		}
	}, 100);
}

function stopScrolling(scroll) {
	scroll.isActive = false;
	clearInterval(scroll.interval);
	scroll.interval = null;
}
