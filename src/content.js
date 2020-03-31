'use strict';

const state = {
	isActive: false,
	scroll: {
		interval: null
	},
	scrape: {
		observer: null,
		data: {
			posts: [],
			mutationRecords: []
		},
		selectors: {
			feed: '._5pcb[aria-label="News Feed"][role="region"]',
			posts: '._4-u2.mbm._4mrt._5jmm._5pat._5v3q._7cqq._4-u8',
			author: '.fwb a',
			likes: '._81hb',
			comments: {
				number: '._3hg-._42ft'
			}
		}
	}
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.toggleScrollAndScrape) {
		toggleScrollAndScrape(state);
	}
});

function toggleScrollAndScrape(state) {
	if (!state.isActive) {
		start(state);
	} else {
		stop(state);
	}
}

function start(state) {
	state.isActive = true;
	startScraping(state.scrape);
	startScrolling(state.scroll);
}

function stop(state) {
	state.isActive = false;
	stopScrolling(state.scroll);
	stopScraping(state.scrape);

	formatMutationRecords(state.scrape.data);

	console.log(state.scrape.data.posts);
}

function startScrolling(scroll) {
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
	clearInterval(scroll.interval);
	scroll.interval = null;
}

function startScraping(scrape) {
	const feed = document.querySelector(scrape.selectors.feed);
	if (!scrape.observer) {
		scrape.data.posts = Array.from(feed.querySelectorAll(scrape.selectors.posts)).filter(
			(post) => post.id.split('_')[2][0] !== ':'
		);

		scrape.observer = new MutationObserver(observeNewPosts);
	}

	scrape.observer.observe(feed, {
		childList: true
	});
}

function observeNewPosts(mutationList) {
	mutationList.forEach((mutation) => state.scrape.data.mutationRecords.push(mutation));
}

function stopScraping(scrape) {
	// const lastPendingMutations = scrape.observer.takeRecords(); // Not sure if this would work
	scrape.observer.disconnect();
}

function formatMutationRecords(data) {
	while (data.mutationRecords.length) {
		data.mutationRecords[0].addedNodes.forEach((post) => data.posts.push(post));

		data.mutationRecords.shift();
	}
}
