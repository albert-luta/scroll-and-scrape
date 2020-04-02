# Scroll and scrape

A chrome extension that scrapes facebook groups for posts.

## Installation:

-   Open [Chrome Extension Manager](chrome://extensions/)
-   Activate **Developer mode** from the top-right corner
-   Click on the 'Load unpacked' button in the top-left corner
-   Select src folder(from this repo folder lul)
-   Try the extension on different sites(and watch the dev console) :)

## Usage:

-   Go to a facebook group(if not, you'll get a log in the console)
-   Open the dev console to see the state of the scraping process
-   Open the popup and press "Start Scraping"
-   Wait until you see "Scroll and scrape: The execution finished"
-   Check the data scraped, shown in the console

### Notes:

-   If you scrape the same page twice without reloading, you'll get an empty array, because the timestamp will be updated at the end of the 1st one(with the newest post's)
-   Don't start the script(press the button) before the page completely loads(if you do, if the page doesn't load in 3(changable) seconds, you'll need to start the script again)
-   As fetching initial posts is not yet implemented, the scraping process will continue until the number of days(at this moment, hardcoded) is satisfied

## Tasks:

-   [x] Learn to scroll using js
-   [x] Make a button in the popup ext that toggles the scroll
-   [x] Figure out how to scrape a static page
-   [x] Figure out how to scrape a dynamic page
-   [x] Extend the func of that scroll button to scroll and scrape
-   [x] Change the setInterval async logic of the algo to sync
-   [x] Add the feature for the last post scraped or x days prior, if it's the first time on that group
-   [ ] Add the feature to detect if the group's age is < x days
-   [ ] Make the "start scrape" event to not trigger if the page loads

## Bugs:

-   [ ] The initial posts are lost, if it's on a fb group, but not chronological ordered(it gets redirected) => sol: receives a config object along with the message to start scraping
