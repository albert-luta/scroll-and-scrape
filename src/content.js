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

// pentru grupuri noi, care nu au inca 30 de zile de la infiintare, detecteaza cand esti la sfarsitul paginii si nu se mai transmit req pentru postari noi; o alternativa nu foarte buna e un setTimeout de cand ai ajuns la sfarsitul paginii
// log-uri mai peste tot, pentru a fi usor sa urmaresti evolutia algo

const state = {
	isActive: false,
	shouldContinueScrolling: false,
	lastTimestamp: new Date().setDate(new Date().getDate() - 5),
	scrape: {
		newPosts: [],
		initialPosts: []
	}
};

const observer = new MutationObserver(observeNewPosts);

function observeNewPosts(mutations) {
	const posts = formatPosts(mutations[0].addedNodes);

	state.shouldContinueScrolling = handleNewPosts(posts);
	if (state.shouldContinueScrolling) {
		scroll1Time();
	} else {
		observer.disconnect();
		stop();
	}
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
			startScrollingAndScrapping();
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

async function startScrollingAndScrapping() {
	console.log('Scroll and scrape: The execution started');

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

		stop();
		return;
	}

	const preRenderedPosts = formatPosts(feed.querySelectorAll(selectors.posts));
	state.shouldContinueScrolling = handleNewPosts(preRenderedPosts);
	if (!state.shouldContinueScrolling) {
		stop();
		return;
	}

	observer.observe(feed, {
		childList: true
	});
	scroll1Time();
}

function stop() {
	state.isActive = false;
	console.log('Scroll and scrape: The execution finished');
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

function handleNewPosts(posts) {
	for (let post of posts) {
		if (post.timestamp < state.lastTimestamp) {
			return false;
		}

		state.scrape.newPosts.push(post);
	}
	return true;
}

function scroll1Time() {
	console.log('Scroll and scrape: Scroll');
	window.scroll({
		top: document.body.clientHeight - window.innerHeight
	});
}
