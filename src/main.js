/**
 * Please don't judge my Javascript skills based on selectors I used here, I just used chrome devtools to do that. It was just easy. Sorry
 */
(function () {
    "use strict";
    console.log("ext loaded");
    var TIMELINE; // This will have value when used for first time, and cached for further usages
    var TRACK_DURATION;
    /**
     * Converts hh:mm:ss string to milliseconds int
     */
    function parseHoursMinutesSecondsToMs(str) {
        var hhmmss = str.match(/(\d\d)|(\d)/g);
        var hh, mm, ss;
        // If two segments were found, that means there's only minutes and seconds
        if(hhmmss.length === 2) {
            hh = 0;
            mm = parseInt(hhmmss[0], 10);
            ss = parseInt(hhmmss[1], 10);
        }
        else {
            hh = parseInt(hhmmss[0], 10);
            mm = parseInt(hhmmss[1], 10);
            ss = parseInt(hhmmss[2], 10);
        }

        // convert them to ms
        hh = hh * 60 * 60 * 1000;
        mm = mm * 60 * 1000;
        ss = ss * 1000;

        return hh + mm + ss;
    }
    /**
     * Finds and marks timestamps found in a piece of text
     */
    function detectAndMarkTimestamps(target) {
        var text = target.innerHTML;
        var timestampPattern = /(\d\d:\d\d:\d\d)|(\d\d:\d\d)|(\d:\d\d)/g;
        console.log('yes');        
        var timestamps = text.match(timestampPattern);
        var replacementMap = {};
        for (var i in timestamps) {
            var finalTimestamp = parseHoursMinutesSecondsToMs(timestamps[i]);
            replacementMap[timestamps[i]] = `<button class="timestamp-4-sc-navigate" data-timestamp="${finalTimestamp}">${timestamps[i]}</button>`;
        }
        var newHtml = text.replace(timestampPattern, function (t) {
            return replacementMap[t];
        });

        target.innerHTML = newHtml;
    }
    /**
     * Makes the playing track jump to given timestamp
     */
    function jumpToTimestamp(timestamp) {
        TIMELINE = document.querySelector("#app > div.playControls.g-z-index-header.m-visible > div > div > ul > li.playControls__timeline.sc-clearfix > div > div.playbackTimeline__progressWrapper");
        // If timeline is not present that means, track is not playing. So first let's play that...
        if(TIMELINE === null || TIMELINE === undefined) {
            document.querySelector("#content > div > div.l-listen-hero > div > div.fullListenHero__foreground > div.fullListenHero__title > div > div > div.soundTitle__playButton.soundTitle__playButtonHero > button").dispatchEvent(new MouseEvent('click'));
            // Since the track just started playing, we'll defer jump a little just to honor sc inner funtions to get ready
            setTimeout(function() {
                jumpToTimestamp(timestamp);
            }, 1000);
            // After successfully deferring the request we'll end this session here.
            return;
        }
        if(TRACK_DURATION === undefined) {
            TRACK_DURATION = parseInt(TIMELINE.getAttribute("aria-valuemax"), 10);
        }
        // Since there's not really an API to ask player to go to a time, we'll be using mouse events on the timeline
        // To do that we'll calculate how much we need to be from the far left side to click there. So we'll use a relativeRatio
        // ratio between time and screen pixels.
        var relativeRatio = (timestamp/TRACK_DURATION) * 100;
        // Here's we'll prepare the virtual event configuration based on the data
        var virtualEventConfig = {
            bubbles: true,
            button: 0,
            buttons: 1,
            cancelBubble: false,
            cancelable: true,
            clientX: ((parseFloat(window.getComputedStyle(TIMELINE).width) * relativeRatio) / 100) + TIMELINE.getBoundingClientRect().left + 5.3, // 5.3 is the magic number to adjust SC's snapping algorithm
            clientY: TIMELINE.getBoundingClientRect().top
        };
        TIMELINE.dispatchEvent(new MouseEvent('mousedown', virtualEventConfig));
        TIMELINE.dispatchEvent(new MouseEvent('mouseup', virtualEventConfig));
        // This is for developers/contributors, since SC timeline is not exactly accurate instead, it snaps to specific time, it'll log time offset that SC didn't follow
        var debug = document.querySelector("#app > div.playControls.g-z-index-header.m-visible > div > div > ul > li.playControls__timeline.sc-clearfix > div > div.playbackTimeline__timePassed");
        var timeApplied = parseHoursMinutesSecondsToMs(debug.getElementsByTagName("span")[1].innerText);
        console.log("err_offset", timestamp - timeApplied);
    }

    function init() {
        // Since sc sort of ajax based, there's not really a window onload thing, so we'll check for description every second if it's loaded to inject the timestamps
        var loadCheck = setInterval(function () {            
            var description = document.querySelector("#content > div > div.l-listen-wrapper > div.l-about-main > div > div.l-about-row.l-listen__mainContent > div.l-about-right > div > div.listenDetails__partialInfo > div > div > div > div.sc-type-small");
            if(description !== null) {
                detectAndMarkTimestamps(description);
                clearInterval(loadCheck);
            }
        }, 1000);
    }

    window.onload = function () {
        // If user is already on a track specific page, eg https://soundcloud.com/artist-name/track-name, then init the thing
        if(/https:\/\/soundcloud.com\/[a-zA-Z0-9]+\/[a-zA-Z0-9]+/g.test(window.location.href)) {
            init();
        }
        // WARNING: THIS IS WORKAROUND THAT I HAD TO USE, AND NEEDS TO REMOVED ASAP
        var urlCheckLoop = setInterval(function () {
            if(/https:\/\/soundcloud.com\/[a-zA-Z0-9]+\/[a-zA-Z0-9]+/g.test(window.location.href)) {
                init();
                clearInterval(urlCheckLoop);
            }
        }, 4000);
        // Otherwise if they are on say https://soundcloud.com/stream, then see if they navigates to a track page from there on
        document.addEventListener('click', function (e) {
            var target = e.target;
            // If user clicked either on track art or track name.. that means they are going to track page
            // And track page is where we'll find description of track and comments to activate timestamps
            if(target.className === "soundTitle__title sc-link-dark" || target.className === "sound__coverArt") {
                init(); // THIS IS NOT WORKING AND NEEDS TO BE FIXED ASAP
            }

            if(target.className === "timestamp-4-sc-navigate") {
                e.preventDefault();
                window.location.hash = "";
                var timestamp = parseInt(target.getAttribute("data-timestamp"), 10);
                jumpToTimestamp(timestamp);
            }
        });
    };
}());