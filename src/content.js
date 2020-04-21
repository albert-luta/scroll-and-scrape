'use strict';

// la sfarsitul partii de dev, poate in IIFE pt a nu polua global scope

// Edge cases:
// - pentru grupuri noi, care nu au inca 30 de zile de la infiintare, detecteaza cand esti la sfarsitul paginii si nu se mai transmit req pentru postari noi; o alternativa nu foarte buna e un setTimeout de cand ai ajuns la sfarsitul paginii
// - format date trb imbunatatit daca fb este in alta limba decat en
// - you cannot change the sorting setting to "chronological" in public groups in which you are not a member

// Bugs:
// - the message from each post is incomplete, it needs to press 'See more' and wait for the whole message to show up
// - doesn't catch emojis inside the message(because they aren't there, but in the attr aria-label of some nested span)

/**
 * Contains the month names, used to get the index of the month
 * @type {Array<String>}
 */
const MONTH_NAMES = [
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
	'december',
];

/**
 * Number of milliseconds in 1 hour
 */
const MILLISECONDS_HOUR = 60 * 60 * 1000;

/**
 * Contains all the selectors used for scraping
 * @type {Object}
 */
const selectors = {
	feed: '[role="feed"]',
	post: '.sjgh65i0.l9j0dhe7.k4urcfbm.du4w35lb',
	linkToPost:
		'.oajrlxb2.g5ia77u1.qu0x051f.esr5mh6w.e9989ue4.r7d6kgcz.rq0escxv.nhd2j8a9.nc684nl6.p7hjln8o.kvgmc6g5.cxmmr5t8.oygrvhab.hcukyx3x.jb3vyjys.rz4wbd8a.qt6c0cv9.a8nywdso.i1ao9s8h.esuyzwwr.f1sip0of.lzcic4wl.gmql0nx0.gpro0wi8.b1v8xokw', // First span within also contains the date
	linkToAuthor:
		'.oajrlxb2.g5ia77u1.qu0x051f.esr5mh6w.e9989ue4.r7d6kgcz.rq0escxv.nhd2j8a9.nc684nl6.p7hjln8o.kvgmc6g5.cxmmr5t8.oygrvhab.hcukyx3x.jb3vyjys.rz4wbd8a.qt6c0cv9.a8nywdso.i1ao9s8h.esuyzwwr.f1sip0of.lzcic4wl.oo9gr5id.gpro0wi8.lrazzd5p', // First span within also contains the author
	isShared: [
		'.hqeojc4l',
		'.l6v480f0.maa8sdkg.s1tcr66n.aypy0576.ue3kfks5.pw54ja7n.uo3d90p7.l82x9zwi.tvfksri0.ozuftl9m',
	],
	// Inside the post
	message: {
		justText: '.f530mmz5.b1v8xokw.o0t2es00.oo9gr5id',
		general:
			'.oi732d6d.ik7dh3pa.d2edcug0.qv66sw1b.c1et5uql.a8c37x1j.muag1w35.enqfppq2.jq4qci2q.a3bd9o3v.knj5qynh.oo9gr5id',
	},
	seeMore:
		'.oajrlxb2.g5ia77u1.qu0x051f.esr5mh6w.e9989ue4.r7d6kgcz.rq0escxv.nhd2j8a9.nc684nl6.p7hjln8o.kvgmc6g5.cxmmr5t8.oygrvhab.hcukyx3x.jb3vyjys.rz4wbd8a.qt6c0cv9.a8nywdso.i1ao9s8h.esuyzwwr.f1sip0of.lzcic4wl.oo9gr5id.gpro0wi8.lrazzd5p', // Inside the message element
	likes: '.stjgntxs.ni8dbmo4.p0l241xz.s70u1j17.ef36h4xz.csza95pw .l9j0dhe7 .pcp91wgn',
	comments: '.l9j0dhe7 .gtad4xkn', // Can include both comments and 'seen by x' text

	// Old facebook interface selectors
	//	feed: '._5pcb[aria-label="News Feed"][role="region"]',
	// 	posts: '._4-u2.mbm._4mrt._5jmm._5pat._5v3q._7cqq._4-u8',
	// 	date: '._5ptz .timestampContent',
	// 	author: '.fwb a',
	// 	text: '._5pbx.userContent._3576',
	// 	likes: '._81hb',
	// 	comments: '._3hg-._42ft'
};

/**
 * The state of the script
 * @type {Object}
 * @property {String} groupParam - The fb group's unique param
 * @property {Boolean} isActive - Denotes the state of the scraping; if it has already started, it would ignore all other events; it cannot be stopped
 * @property {Boolean} shouldContinueScrolling - Indicates if another scroll is required(if the timestamp of our last new post is < newest old post)
 * @property {Boolean} reachedTheLastPost - Indicates if the scraping reached the last post, if true -> the new posts are concatenated with the old ones, if false -> the new posts are discarded
 * @property {Array<Object>} newPosts - The new posts received from (current)scraping, initially empty
 * @property {Object} lastPost - The last post's details, to identify where the new posts should stop more precisely
 */
const state = {
	groupParam: null,
	isActive: false,
	shouldContinueScrolling: false,
	reachedTheLastPost: false,
	newPosts: [],
	lastPost: null,
};

/**
 * Observes the changes in the dom, used to detect posts additions
 * @type {Object}
 */
const observer = new MutationObserver(observeNewPosts);

/**
 * Handles changes observed by the observer, used to format the new posts and add them into the state.newPosts array
 * @param {Array<MutationRecord>} mutations - All the changes
 */
function observeNewPosts(mutations) {
	const posts = Array.from(mutations).reduce(
		(acc, curr) => [...acc, ...formatPosts(curr.addedNodes)],
		[]
	);

	state.shouldContinueScrolling = handleNewPosts(posts);
	// Just for test, to see if it skips any posts
	if (state.shouldContinueScrolling) console.log('Missing posts:', checkMissingPosts());

	if (state.shouldContinueScrolling) {
		scroll1Time();
	} else {
		stop();
	}
}

/**
 * Listens for all the possible messages from popup/background scripts; contains some error handling(just logs)
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	// Receives an error and logs it
	if (request.error) {
		console.log('Scroll and scrape:', request.error);
	}
	// Receives the message to start the scraping process
	else if (request.start) {
		if (state.isActive) {
			console.log('Scroll and scrape: Already running');
		} else {
			startScrollingAndScrapping(request);
		}
	}
	// Fallback, if it doesn't recognize the message
	else {
		console.log('Scroll and scrape: Unknown behavior');
	}
});

/**
 * Starts the scraping process and cotrols the flow(error/edge case handling); most important function
 */
async function startScrollingAndScrapping(request) {
	console.log('Scroll and scrape: The execution started');

	// Checks to is if the scraping is already running
	if (state.isActive) {
		console.log('Scroll and scrape: Already running');
		return;
	}
	state.isActive = true;

	// Initialize the state to begin scraping
	const { groupParam, lastPost } = request;
	state.groupParam = groupParam;
	state.lastPost = lastPost;

	// If it cannot find the feed element(most important one), tries for 2 more times
	const feed = await (async () => {
		let maxTries = 15;
		while (maxTries) {
			const temp = document.querySelectorAll(selectors.feed);
			if (temp.length) {
				return temp[temp.length - 1];
			} else {
				console.log(`Scroll and scrape: Error locating the feed. Retry ${maxTries}...`);
				maxTries--;
				await wait(1000);
			}
		}
		return null;
	})();
	if (!feed) {
		stop(true);
		return;
	}
	// Gets the already rendered posts and checks to see it is needed to load new ones
	const preRenderedPosts = formatPosts(feed.querySelectorAll(selectors.post));
	state.shouldContinueScrolling = handleNewPosts(preRenderedPosts);
	if (!state.shouldContinueScrolling) {
		stop();
		return;
	}

	// Sets the observer and scroll 1 time, to get observer's handler going
	observer.observe(feed, {
		childList: true,
	});
	scroll1Time();
}

/**
 * Run de directives needed at the end of the scraping process, more like a script than a traditional 'function'
 */
function stop(couldntLocateFeed = false) {
	state.isActive = false;
	state.shouldContinueScrolling = false;
	state.lastPost = null;
	observer.disconnect();

	console.log('Scroll and scrape: The execution finished');

	const { groupParam, newPosts } = state;

	if (couldntLocateFeed) {
		chrome.runtime.sendMessage({ groupParam, couldntLocateFeed });
		console.log("Scroll and scrape: Couldn't locate the feed, trying again...");
	} else {
		if (state.reachedTheLastPost) {
			if (!newPosts.length) {
				chrome.runtime.sendMessage({ groupParam, newPosts: null });
				console.log('Scroll and scrape: Already on last post');
			} else {
				chrome.runtime.sendMessage({ groupParam, newPosts });

				console.table(state.newPosts);
			}
		} else {
			chrome.runtime.sendMessage({ groupParam, newPosts: null });
			console.log(
				"Scroll and scrape: Couldn't reach the last post, the new posts were discarded"
			);
		}
	}

	state.groupParam = null;
	state.reachedTheLastPost = false;
	state.newPosts = [];
}

/**
 * Async waits a number of milliseconds
 * @param {Number} ms - Number of milliseconds to wait
 * @returns {Promise}
 */
async function wait(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * Receives a nodelist, transforms it into an array and for each node extracts the data needed
 * @param {NodeList} posts - NodeList to format
 * @returns {Array<Object>} Formatted posts
 */
function formatPosts(posts) {
	return Array.from(posts).map((post) => {
		const linkToPostElement = post.querySelector(selectors.linkToPost);
		const linkToPost = linkToPostElement.href;
		const timestamp = getTimestampFromDate(linkToPostElement.textContent);

		const linkToAuthorElement = post.querySelector(selectors.linkToAuthor);
		const linkToAuthor = linkToAuthorElement.href;
		const author = linkToAuthorElement.textContent;

		let message = post.querySelector(selectors.message.justText);
		// Type of message: just text
		if (message) {
			message = message.textContent;
		}
		// Type of message: general
		else {
			message = post.querySelector(selectors.message.general);
			if (message) {
				// The post doesn't have a message(grabs incorrectly something else from the shared post)
				if (isShared(message)) {
					message = null;
				}
				// The post does have a message(grabs it correctly)
				else {
					message = message.textContent;
				}
			}
		}
		const likesElement = post.querySelector(selectors.likes);
		const likes = likesElement ? parseInt(likesElement.textContent) : 0;

		// QuerySelectorAll, in case we have both comments text and 'seen by x' text
		// The comments text is always the first(if it exists)
		let comments = post.querySelectorAll(selectors.comments);
		if (comments.length) {
			comments = parseInt(comments[0].textContent.split(' ')[0]);
			// The comments text always starts with the number and the 'seen by x' text always starts with 'seen'
			if (Number.isNaN(comments)) {
				comments = 0;
			}
		} else {
			comments = 0;
		}

		return { linkToPost, timestamp, linkToAuthor, author, message, likes, comments };
	});

	// Old facebook interface selectors
	// return (
	// 	Array.from(posts)
	// 		// Filter for non-post elements
	// 		.filter((post) => post.id.split('_')[2][0] !== ':')
	// 		.map((post) => {
	// 			const timestamp = getTimestampFromDate(
	// 				post.querySelector(selectors.date).parentNode.getAttribute('title')
	// 			);
	// 			const author = post.querySelector(selectors.author).textContent;
	// 			const text = post.querySelector(selectors.text)
	// 				? post.querySelector(selectors.text).textContent
	// 				: '';
	// 			const likes = post.querySelector(selectors.likes)
	// 				? parseInt(post.querySelector(selectors.likes).textContent)
	// 				: 0;
	// 			const comments = post.querySelector(selectors.comments)
	// 				? parseInt(post.querySelector(selectors.comments).textContent.split(' ')[0])
	// 				: 0;

	// 			return { timestamp, author, text, likes, comments };
	// 		})
	// );
}

/**
 * Checks to see if the current message is from a shared post(inside) or not
 * @param {HTMLElement} message - The message you want to check
 * @returns {Boolean}
 */
function isShared(message) {
	return selectors.isShared
		.map((selector) => message.closest(selector))
		.some((el) => el !== null);
}

/**
 * Receives a string date and returns it's timestamp
 * @param {String} date - The string date
 * @returns {Timestamp} Timestamp from the string date
 */
function getTimestampFromDate(date) {
	date = date.toLocaleLowerCase().split(' ');
	const currentDate = new Date();

	const today = ['mins', 'hr', 'hrs']; // Needs some adding for minutes and seconds, but couldn't find any posts that recent at this moment

	// Post's age is less than 24h(today)
	if (today.map((str) => date.includes(str)).some((bool) => bool)) {
		let [hoursAgo] = date;

		// Some checks for NaN
		hoursAgo = parseInt(hoursAgo);

		return Date.now() - hoursAgo * MILLISECONDS_HOUR;
	}
	// Post's age is >=24h && <48h(yesterday)
	else if (date.includes('yesterday')) {
		const time = date.pop();
		let [hours, minutes] = time.split(':');

		// Some checks for NaN
		hours = parseInt(hours);
		minutes = parseInt(minutes);

		return new Date(
			currentDate.getFullYear(),
			currentDate.getMonth(),
			currentDate.getDate() - 1,
			hours,
			minutes
		).getTime();
	}
	// From the past year
	else if (date.length === 3) {
		let [day, month, year] = date;

		year = parseInt(year);
		month = MONTH_NAMES.indexOf(month);
		day = parseInt(day);

		return new Date(year, month, day).getTime();
	}
	// Post's age is >=48 h(any other day)
	else {
		// Check for > 1 yo
		// ----
		let day, month, time, hours, minutes;

		[day, month, , time] = date;
		if (!time) {
			time = hours = minutes = null;
		} else {
			[hours, minutes] = time.split(':');
			hours = parseInt(hours);
			minutes = parseInt(minutes);
		}

		// Error handling(Nan, not a good month name)
		month = MONTH_NAMES.indexOf(month);
		day = parseInt(day);

		return new Date(currentDate.getFullYear(), month, day, hours, minutes).getTime();
	}

	// Old facebook interface formatting
	// const [, importantPart] = date.split(', ');
	// let [day, month, year, , time] = importantPart.split(' ');
	// let [hour, minutes] = time.split(':');

	// year = parseInt(year);
	// month = MONTH_NAMES.indexOf(month.toLowerCase());
	// day = parseInt(day);
	// hour = parseInt(hour);
	// minutes = parseInt(minutes);

	// return new Date(year, month, day, hour, minutes).getTime();
}

/**
 * Receives an array of posts(already formatted) and checks the timestamp of each post to be < state.lastPost.timestamp
 * @param {Array<Object>} posts - The new posts received from the observer
 * @returns {Boolean} Indicates if the scrolling should continue(load new posts) or not
 */
function handleNewPosts(posts) {
	for (let post of posts) {
		if (foundLastPost(post)) {
			state.reachedTheLastPost = true;
			return false;
		}

		state.newPosts.push(post);
	}
	return true;
}

/**
 * Check for the last post, based on either just timestamp, if there are no previos posts for that group, or on timestamp
 * @param {Object} post - Current post object to check
 * @returns {Boolean} If it has found the last post
 */
function foundLastPost(post) {
	if (!state.lastPost.author) {
		return Boolean(post.timestamp <= state.lastPost.timestamp);
	} else {
		return Boolean(
			post.timestamp <= state.lastPost.timestamp ||
				(post.author === state.lastPost.author && post.message === state.lastPost.message)
		);
	}
}

/**
 * Move the window to the end of the page to load new posts
 */
function scroll1Time() {
	console.log('Scroll and scrape: Scroll');
	window.scroll({
		top: document.body.clientHeight - window.innerHeight,
	});
}

// Just for testing if there are any missing posts each iteration
function checkMissingPosts() {
	return (
		state.newPosts.length !==
		document.querySelector(selectors.feed).querySelectorAll(selectors.post).length
	);
}
