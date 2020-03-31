'use strict';

const selectors = {
	feed: '._5pcb[aria-label="News Feed"][role="region"]',
	posts: '._4-u2.mbm._4mrt._5jmm._5pat._5v3q._7cqq._4-u8',
	date: '._5ptz .timestampContent',
	author: '.fwb a',
	text: '._5pbx.userContent._3576',
	likes: '._81hb',
	comments: '._3hg-._42ft'
};

// in loc de setInterval, incearca sa faci totul sincron(sa astepte dupa manipularea mutationRecords), cel mai probabil cu while(conditie), conditie pe care o vei schimba la sfarsitul while-ului, dupa manipularea de date(datele noi primite)
// in state 1 prop cu conditia(boolean)
// *lasa in continuare isActive, pentru a da toggle
// in state 1 prop care tine "ultimul"(cel mai aproape de momentul curent) timestamp, dupa care calculezi conditia
// daca nu exista un ultim timestamp(e prima oara cand dan scraping grupului), dai fallback spre {{ new Date().setDate(new Date().getDate() - 30) }}
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
		}
	}
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	// if (request.toggleScrollAndScrape) {
	// 	toggleScrollAndScrape(state);
	// }
	if (request.error) {
		console.warn('Scroll and scrape:', request.error);
	} else {
		console.log('This is a fb group');
	}

	// if (request.toggleScrollAndScrape) {
	// 	toggleScrollAndScrape(state);
	// }
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
	let scrollPosition = 0; // window.pageYOffset
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
	const feed = document.querySelector(selectors.feed);
	if (!scrape.observer) {
		scrape.data.posts = Array.from(feed.querySelectorAll(selectors.posts)).filter(
			(post) => post.id.split('_')[2][0] !== ':'
		);

		scrape.observer = new MutationObserver(observeNewPosts);
	}

	scrape.observer.observe(feed, {
		childList: true
	});
}

function observeNewPosts(mutationList) {
	state.scrape.data.mutationRecords;
	mutationList.forEach((mutation) => state.scrape.data.mutationRecords.push(mutation));
	console.log(mutationList);
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
