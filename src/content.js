'use strict';

// la sfarsitul partii de dev, poate in IIFE pt a nu polua global scope
const monthNames = [
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december'
];

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
// in state 1 prop cu conditia(boolean) - refresh
// *lasa in continuare isActive, pentru a da toggle
// in state 1 prop care tine "ultimul"(cel mai aproape de momentul curent) timestamp, dupa care calculezi conditia
// daca nu exista un ultim timestamp(e prima oara cand dai scraping grupului), dai fallback spre {{ new Date().setDate(new Date().getDate() - 30) }}
// ---
// pentru grupuri noi, care nu au inca 30 de zile de la infiintare, detecteaza cand esti la sfarsitul paginii si nu se mai transmit req pentru postari noi; o alternativa nu foarte buna e un setTimeout de cand ai ajuns la sfarsitul paginii
// log-uri mai peste tot, pentru a fi usor sa urmaresti evolutia algo

const state = {
	isActive: false,
	refresh: false,
	lastTimestamp: new Date().setDate(new Date().getDate() - 30),
	scrape: {
		newPosts: [],
		initialPosts: []
	}
};

const observer = new MutationObserver(observeNewPosts);

function observeNewPosts(mutationList) {
	// state.scrape.data.mutationRecords;
	// mutationList.forEach((mutation) => state.scrape.data.mutationRecords.push(mutation));
	console.log(mutationList);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.error) {
		console.log('Scroll and scrape:', request.error);
	} else if (request.initialPosts) {
		if (state.isActive) {
			console.log('Scroll and scrape: Cannot set the initial posts while scraping');
		} else {
			initializePosts(request.initialPosts);
		}
	} else if (request.daysToScrape) {
		if (state.isActive) {
			console.log('Scroll and scrape: Cannot update days to scrape while scraping');
		} else if (state.scrape.initialPosts.length) {
			console.log(
				'Scroll and scrape: Cannot update days to scrape after setting the initial posts'
			);
		} else {
			state.lastTimestamp = new Date().setDate(new Date().getDate() - request.daysToScrape);
		}
	} else if (request.startScraping) {
		if (state.isActive) {
			console.log('Scroll and scrape: Already running');
		} else {
			BEGIN();
		}
	} else {
		console.log('Scroll and scrape: Unknown behavior');
	}
});

function initializePosts(initialPosts) {
	if (!initialPosts.length) return;

	state.scrape.initialPosts = initialPosts;
	state.lastTimestamp = initialPosts[0].timestamp;
}

async function BEGIN() {
	if (state.isActive) {
		console.log('Scroll and scrape: Already running');
		return;
	}
	state.isActive = true;

	const feed = await (async () => {
		let maxTries = 3;
		while (maxTries) {
			const temp = document.querySelector(selectors.feed);
			if (temp) {
				return temp;
			} else {
				console.log(`Scroll and scrape: Error locating the feed. Retry ${maxTries}...`);
				maxTries--;
				await wait(1000);
			}
		}
		return null;
	})();

	if (!feed) {
		console.log("Scroll and scrape: Couldn't find the feed, reload the page and try again");

		state.isActive = false;
		return;
	}

	const preRenderedPosts = formatPosts(feed.querySelectorAll(selectors.posts));
	for (let post of preRenderedPosts) {
		// creeaza o functie care da check pe timestamp-uri
		if (post.timestamp < state.lastTimestamp) {
			state.isActive = false;
			// return;
		}
	}
	console.table(preRenderedPosts);
	state.isActive = false;
	// if (!scrape.observer) {
	// 	scrape.data.posts = Array.from(feed.querySelectorAll(selectors.posts)).filter(
	// 		(post) => post.id.split('_')[2][0] !== ':'
	// 	);

	// 	scrape.observer = new MutationObserver(observeNewPosts);
	// }
}

async function wait(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function formatPosts(posts) {
	return Array.from(posts)
		.filter((post) => post.id.split('_')[2][0] !== ':')
		.map((post) => {
			const timestamp = getTimestampFromDate(
				post.querySelector(selectors.date).parentNode.getAttribute('title')
			);
			const author = post.querySelector(selectors.author).textContent;
			const text = post.querySelector(selectors.text)
				? post.querySelector(selectors.text).textContent
				: '';
			const likes = post.querySelector(selectors.likes)
				? parseInt(post.querySelector(selectors.likes).textContent)
				: 0;
			const comments = post.querySelector(selectors.comments)
				? parseInt(post.querySelector(selectors.comments).textContent.split(' ')[0])
				: 0;

			return { timestamp, author, text, likes, comments };
		});
}

function getTimestampFromDate(date) {
	const [, importantPart] = date.split(', ');
	let [day, month, year, , time] = importantPart.split(' ');
	let [hour, minutes] = time.split(':');

	year = parseInt(year);
	month = monthNames.indexOf(month.toLowerCase());
	day = parseInt(day);
	hour = parseInt(hour);
	minutes = parseInt(minutes);

	return new Date(year, month, day, hour, minutes).getTime();
}

/* -------------
	To be refactored/deleted
   -------------*/

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
