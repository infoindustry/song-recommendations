document.addEventListener("DOMContentLoaded", function() {
    // User behavior data structure
    const userBehavior = {
        pagesVisited: {},
        clicks: {},
        timeSpent: {}
    };

    /**
     * Extract genres from JSON-LD schema present in the page.
     * This helps in understanding the current page's genre for better recommendations.
     * @returns {Array} - Array of genres in lowercase.
     */
    function getGenresFromSchema() {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const genres = [];
        for(let script of scripts){
            try{
                const data = JSON.parse(script.innerText);
                if(data.genre){
                    if(Array.isArray(data.genre)){
                        genres.push(...data.genre.map(g => g.toLowerCase()));
                    } else {
                        genres.push(data.genre.toLowerCase());
                    }
                }
            } catch(e){
                console.error("Error parsing JSON-LD:", e);
            }
        }
        return genres;
    }

    /**
     * Identify the current song based on the page URL.
     * This ensures that the recommendation system doesn't suggest the same song the user is currently viewing.
     * @returns {Object|null} - The current song object or null if not found.
     */
    function getCurrentSong(){
        const currentPage = window.location.pathname;
        // Attempt to match both absolute and relative URLs
        return songs.find(song => {
            if (!song.pageUrl) return false;
            try {
                const songUrl = new URL(song.pageUrl, window.location.origin).href;
                const currentUrl = window.location.origin + currentPage;
                return songUrl === currentUrl || song.pageUrl === currentPage;
            } catch (e) {
                console.error("Invalid URL in song data:", e);
                return false;
            }
        });
    }

    /**
     * Load user behavior data from sessionStorage.
     * This persists user interactions within the same browsing session.
     */
    function loadUserBehavior(){
        const storedBehavior = sessionStorage.getItem("userBehavior");
        if(storedBehavior){
            Object.assign(userBehavior, JSON.parse(storedBehavior));
            console.log("Loaded user behavior:", userBehavior);
        }
    }

    /**
     * Save user behavior data to sessionStorage.
     * This updates the stored data with the latest user interactions.
     */
    function saveUserBehavior(){
        sessionStorage.setItem("userBehavior", JSON.stringify(userBehavior));
        console.log("Saved user behavior:", userBehavior);
    }

    /**
     * Track page visits by incrementing the visit count for the current page.
     */
    function trackPageVisit(){
        const page = window.location.pathname;
        userBehavior.pagesVisited[page] = (userBehavior.pagesVisited[page] || 0) + 1;
        console.log("Page visited:", page, "Total visits:", userBehavior.pagesVisited[page]);
        saveUserBehavior();
    }

    /**
     * Setup click tracking using event delegation.
     * This listens for clicks on any <a> tag and tracks them if they correspond to song URLs.
     */
    function setupClickTracking(){
        document.body.addEventListener("click", function(event) {
            let target = event.target;

            // Traverse up to find the nearest <a> tag
            while(target && target !== document.body && target.tagName !== 'A'){
                target = target.parentElement;
            }

            if(target && target.tagName === 'A'){
                const href = target.getAttribute('href');
                if(href){
                    const song = songs.find(s => {
                        // Ensure href comparison accounts for relative and absolute URLs
                        try {
                            const songUrl = new URL(s.pageUrl, window.location.origin).href;
                            const linkUrl = new URL(href, window.location.origin).href;
                            return songUrl === linkUrl;
                        } catch (e) {
                            console.error("Invalid URL in song data or link:", e);
                            return false;
                        }
                    });
                    if(song){
                        trackClick(song.title);
                        handleRecommendationClick(song); // Push GA event if needed
                    }
                }
            }
        });
    }

    /**
     * Track clicks on specific songs by incrementing their click count.
     * @param {string} songTitle - The title of the song clicked.
     */
    function trackClick(songTitle){
        if(userBehavior.clicks[songTitle]){
            userBehavior.clicks[songTitle] += 1;
        } else {
            userBehavior.clicks[songTitle] = 1;
        }
        console.log("Clicked on song:", songTitle, "Total clicks:", userBehavior.clicks[songTitle]);
        saveUserBehavior();
    }

    /**
     * Handle click events on the recommendation card.
     * Pushes a 'recommendation_clicked' event to dataLayer for GA tracking.
     * @param {Object} song - The song object that was clicked.
     */
    function handleRecommendationClick(song) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'recommendation_clicked',
            'songTitle': song.title,
            'songGenre': song.genres,
            'songId': song.id
        });
    }

    /**
     * Track the time spent on the current page.
     * This increments the timeSpent for the page based on the duration the user stayed.
     */
    function trackTimeSpent(){
        const timeSpent = Math.floor((Date.now() - window.pageStartTime) / 1000); // in seconds
        const page = window.location.pathname;
        userBehavior.timeSpent[page] = (userBehavior.timeSpent[page] || 0) + timeSpent;
        console.log("Time spent on page:", page, "Time (seconds):", timeSpent, "Total time:", userBehavior.timeSpent[page]);
        saveUserBehavior();
    }

    /**
     * Recommend a song based on user behavior and current page genres.
     * The function calculates scores based on clicks and time spent to prioritize genres and needs.
     * It also ensures that the current song isn't recommended again.
     * 
     * @param {Array} currentPageGenres - Genres extracted from the current page's schema.
     * @returns {Object|null} - The recommended song object or null if no recommendation is possible.
     */
    function recommendSong(currentPageGenres){
        const genreScores = {};
        const needScores = {};

        const publishedSongs = songs.filter(song => song.pageUrl);
        console.log("Published songs:", publishedSongs);

        // Score based on clicks
        for(const songTitle in userBehavior.clicks){
            const count = userBehavior.clicks[songTitle];
            const song = publishedSongs.find(s => s.title === songTitle);
            if(song){
                const genres = song.genres.toLowerCase().split(",").map(g => g.trim());
                genres.forEach(genre => {
                    genreScores[genre] = (genreScores[genre] || 0) + count * 2;
                });

                const needs = song.spiritualNeeds.toLowerCase().split(",").map(n => n.trim());
                needs.forEach(need => {
                    needScores[need] = (needScores[need] || 0) + count;
                });
            }
        }
        console.log("Genre Scores:", genreScores);
        console.log("Need Scores:", needScores);

        // Score based on time spent
        for(const page in userBehavior.timeSpent){
            const time = userBehavior.timeSpent[page];
            const pageGenres = publishedSongs.filter(song => {
                // Compare song.pageUrl with the page
                try {
                    const songUrl = new URL(song.pageUrl, window.location.origin).href;
                    const currentUrl = window.location.origin + page;
                    return songUrl === currentUrl || song.pageUrl === page;
                } catch (e) {
                    console.error("Invalid URL comparison:", e);
                    return false;
                }
            }).map(song => song.genres.toLowerCase().split(",").map(g => g.trim())).flat();

            pageGenres.forEach(genre => {
                genreScores[genre] = (genreScores[genre] || 0) + Math.floor(time / 60);
            });
        }
        console.log("Genre Scores after time:", genreScores);

        // Score based on current page genres
        if(currentPageGenres.length > 0){
            currentPageGenres.forEach(genre => {
                genreScores[genre] = (genreScores[genre] || 0) + 3;
            });
        }
        console.log("Genre Scores after current genres:", genreScores);

        // Determine top genre
        let finalTopGenre = null;
        let highestGenreScore = -1;
        for(const genre in genreScores){
            if(genreScores[genre] > highestGenreScore){
                highestGenreScore = genreScores[genre];
                finalTopGenre = genre;
            }
        }
        console.log("Top Genre:", finalTopGenre, "Score:", highestGenreScore);

        // If no top genre, pick a random song excluding the current song
        if(!finalTopGenre){
            const randomSong = pickRandomSong(publishedSongs, getCurrentSong());
            console.log("Random song selected:", randomSong);
            return randomSong;
        }

        // Find songs matching the top genre
        const matchingSongs = publishedSongs.filter(song => song.genres.toLowerCase().split(",").map(g => g.trim()).includes(finalTopGenre));
        console.log("Matching Songs:", matchingSongs);

        // If no matching songs, pick a random song excluding the current song
        if(matchingSongs.length === 0){
            const randomSong = pickRandomSong(publishedSongs, getCurrentSong());
            console.log("Random song selected (no matching songs):", randomSong);
            return randomSong;
        }

        // Select the best song based on scores, excluding the current song
        let bestSong = null;
        let highestScore = -1;

        matchingSongs.forEach(song => {
            // Exclude current song
            const currentSong = getCurrentSong();
            if(currentSong && song.title === currentSong.title){
                return; // Skip current song
            }

            const genres = song.genres.toLowerCase().split(",").map(g => g.trim());
            const needs = song.spiritualNeeds.toLowerCase().split(",").map(n => n.trim());
            let score = 0;

            genres.forEach(genre => {
                score += genreScores[genre] || 0;
            });

            needs.forEach(need => {
                score += needScores[need] || 0;
            });

            if(score > highestScore){
                highestScore = score;
                bestSong = song;
            }
        });

        console.log("Best Song:", bestSong, "Score:", highestScore);

        // If no best song found, pick random excluding the current song
        if(!bestSong){
            bestSong = pickRandomSong(matchingSongs, getCurrentSong());
            console.log("Random song selected (bestSong not found):", bestSong);
        }

        return bestSong;
    }

    /**
     * Pick a random song from a list, excluding the current song if provided.
     * @param {Array} songList - List of songs to pick from.
     * @param {Object|null} currentSong - The current song being viewed.
     * @returns {Object|null} - A randomly selected song or null if no songs are available.
     */
    function pickRandomSong(songList, currentSong){
        const filteredSongs = currentSong ? songList.filter(song => song.title !== currentSong.title) : songList;
        if(filteredSongs.length === 0){
            return null; // No songs to pick
        }
        const randomIndex = Math.floor(Math.random() * filteredSongs.length);
        return filteredSongs[randomIndex];
    }

    /**
     * Display the recommendation card with smooth sliding animation.
     * The card appears from the bottom on mobile devices for better visibility.
     * @param {Object} recommendedSong - The song object to be recommended.
     */
    function showRecommendation(recommendedSong){
        console.log("showRecommendation called with song:", recommendedSong);

        // Check if recommendation is already shown within the last 24 hours
        const lastShown = sessionStorage.getItem("lastRecommendationShown");
        const now = Date.now();
        if(lastShown && (now - parseInt(lastShown)) < (24 * 60 * 60 * 1000)){
            console.log("Recommendation was shown within the last 24 hours.");
            return;
        }

        // Create recommendation container
        const container = document.createElement("div");
        container.id = "song-recommendation-container";
        container.style.position = "fixed";
        container.style.bottom = "0"; // Position at the bottom for better visibility on mobile
        container.style.left = "50%";
        container.style.transform = "translateX(-50%) translateY(100%)"; // Initially hidden below the screen
        container.style.transition = "transform 0.5s ease";
        container.style.zIndex = "1001";
        container.style.width = "90%"; // Full width on mobile
        container.style.maxWidth = "400px"; // Maximum width for larger screens
        container.style.boxSizing = "border-box";
        container.style.padding = "10px";

        // Create recommendation card
        const card = document.createElement("div");
        card.id = "song-recommendation-card";
        card.style.backgroundColor = "#242424"; // Updated background color
        card.style.padding = "15px";
        card.style.borderRadius = "10px";
        card.style.width = "100%"; // Full width of container
        card.style.color = "#FFFFFF";
        card.style.display = "flex";
        card.style.flexDirection = "column"; // Column layout for better mobile display
        card.style.alignItems = "flex-start";
        card.style.boxShadow = "2px 2px 10px rgba(0, 0, 0, 0.3)";
        card.style.position = "relative";
        card.style.boxSizing = "border-box";
        card.style.animation = "slideIn 0.5s ease";

        // Close button
        const closeBtn = document.createElement("span");
        closeBtn.innerHTML = "&times;";
        closeBtn.style.position = "absolute";
        closeBtn.style.top = "10px";
        closeBtn.style.right = "15px";
        closeBtn.style.fontSize = "24px";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.color = "#FFFFFF";
        closeBtn.title = "Close Recommendation";
        closeBtn.setAttribute("aria-label", "Close Recommendation");
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent triggering container's click
            document.body.removeChild(container);
            sessionStorage.setItem("lastRecommendationShown", now.toString());
            console.log("Recommendation closed by user.");
        });

        // Informative message
        const infoMessage = document.createElement("p");
        infoMessage.textContent = "We think you'll like it:";
        infoMessage.style.margin = "0 0 10px 0";
        infoMessage.style.fontSize = "16px";
        infoMessage.style.color = "#AAAAAA";
        infoMessage.style.alignSelf = "center";
        infoMessage.style.width = "100%";
        infoMessage.style.textAlign = "center";

        // Song details container
        const details = document.createElement("div");
        details.style.display = "flex";
        details.style.flexDirection = "row";
        details.style.alignItems = "center";
        details.style.width = "100%";

        // Song image
        const img = document.createElement("img");
        img.src = recommendedSong.coverImage || "https://via.placeholder.com/100";
        img.alt = recommendedSong.title;
        img.style.width = "80px";
        img.style.height = "80px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "10px";
        img.style.marginRight = "15px";

        // Song details text
        const textDetails = document.createElement("div");
        textDetails.style.display = "flex";
        textDetails.style.flexDirection = "column";
        textDetails.style.justifyContent = "center";

        // Song title
        const title = document.createElement("h3");
        title.textContent = recommendedSong.title;
        title.style.margin = "0";
        title.style.fontSize = "18px";

        // Song motto
        const motto = document.createElement("p");
        motto.textContent = recommendedSong.motto;
        motto.style.fontStyle = "italic";
        motto.style.margin = "5px 0 0 0";
        motto.style.fontSize = "14px";

        // Action buttons container
        const buttonsDiv = document.createElement("div");
        buttonsDiv.style.display = "flex";
        buttonsDiv.style.flexWrap = "wrap";
        buttonsDiv.style.gap = "10px";
        buttonsDiv.style.marginTop = "10px";

        /**
         * Helper function to create styled link buttons with icons.
         * @param {string} url - The URL the button should link to.
         * @param {string} text - The display text of the button.
         * @param {string} bgColor - The background color of the button.
         * @param {string} iconUrl - The URL of the icon image.
         * @returns {HTMLElement} - The created anchor element styled as a button with an icon.
         */
        function createLinkButton(url, text, bgColor, iconUrl){
            const link = document.createElement("a");
            link.href = url;
            link.target = "_blank";
            link.style.backgroundColor = bgColor;
            link.style.color = "#FFFFFF";
            link.style.padding = "8px 12px";
            link.style.borderRadius = "5px";
            link.style.textDecoration = "none";
            link.style.fontSize = "12px";
            link.style.textAlign = "center";
            link.style.flex = "1 1 45%"; // Adjusted for better fit on mobile
            link.style.display = "flex";
            link.style.alignItems = "center";
            link.style.justifyContent = "center";

            if(iconUrl){
                const icon = document.createElement("img");
                icon.src = iconUrl;
                icon.alt = `${text} Icon`;
                icon.style.width = "20px";
                icon.style.height = "20px";
                icon.style.marginRight = "8px";
                link.appendChild(icon);
            }

            const span = document.createElement("span");
            span.textContent = text;
            link.appendChild(span);

            return link;
        }

        // Add link buttons with icons if URLs are present
        if(recommendedSong.youtube){
            const youtubeLink = createLinkButton(
                recommendedSong.youtube,
                "YouTube",
                "#FF0000",
                "https://static.tildacdn.com/tild3363-6131-4534-a233-356139653132/2.png" // YouTube Icon
            );
            buttonsDiv.appendChild(youtubeLink);
        }
        if(recommendedSong.spotify){
            const spotifyLink = createLinkButton(
                recommendedSong.spotify,
                "Spotify",
                "#1DB954",
                "https://static.tildacdn.com/tild3066-3236-4166-b833-323236643035/5.png" // Spotify Icon
            );
            buttonsDiv.appendChild(spotifyLink);
        }
        if(recommendedSong.appleMusic){
            const appleLink = createLinkButton(
                recommendedSong.appleMusic,
                "Apple Music",
                "#FA233B",
                "https://static.tildacdn.com/tild3962-3032-4035-b862-643064333464/1.png" // Apple Music Icon
            );
            buttonsDiv.appendChild(appleLink);
        }
        if(recommendedSong.playlist){
            const playlistLink = createLinkButton(
                recommendedSong.playlist,
                "Playlist",
                "#be3c10",
                "https://static.tildacdn.com/tild3363-6131-4534-a233-356139653132/2.png" // YouTube Icon as example
            );
            buttonsDiv.appendChild(playlistLink);
        }
        if(recommendedSong.pageUrl){
            const pageLink = createLinkButton(
                recommendedSong.pageUrl,
                "See on Website",
                "#007BFF",
                null // No icon for website link
            );
            buttonsDiv.appendChild(pageLink);
        }

        // Append title and motto to textDetails
        textDetails.appendChild(title);
        textDetails.appendChild(motto);
        textDetails.appendChild(buttonsDiv);

        // Append image and textDetails to details
        details.appendChild(img);
        details.appendChild(textDetails);

        // Append elements to card
        card.appendChild(closeBtn);
        card.appendChild(infoMessage);
        card.appendChild(details);

        // Append card to container
        container.appendChild(card);

        // Append container to body
        document.body.appendChild(container);

        // Trigger the slide-in animation after a slight delay to ensure transition
        setTimeout(() => {
            container.style.transform = "translateX(-50%) translateY(0)"; // Slide in
        }, 100); // 100ms delay

        /**
         * Handle click on the recommendation container to expand or collapse.
         * When expanded, the card rearranges its layout for better visibility.
         */
        container.addEventListener("click", function(){
            if(container.classList.contains("expanded")){
                // Collapse the card back to partial view
                container.style.transform = "translateX(-50%) translateY(100%)";
                container.classList.remove("expanded");
                // Reset card styles to original state
                card.style.flexDirection = "column";
                card.style.width = "100%";
                infoMessage.style.display = "block";
            } else {
                // Expand the card fully into view
                container.style.transform = "translateX(-50%) translateY(0)";
                container.classList.add("expanded");
                // Modify styles for expanded view
                card.style.flexDirection = "column";
                card.style.width = "100%"; // Full width on mobile
                infoMessage.style.display = "none"; // Hide the message when expanded
            }
        });

        // Prevent clicking inside the card from triggering the container's click event
        card.addEventListener("click", function(event){
            event.stopPropagation();
        });

        // Set flag to not show recommendation again within 24 hours
        sessionStorage.setItem("lastRecommendationShown", now.toString());
        console.log("Recommendation shown:", recommendedSong.title);
    }

    /**
     * Trigger the recommendation after certain user interactions.
     * This function ensures that recommendations are shown only when enough data is collected.
     */
    function triggerRecommendation(){
        // Define thresholds for displaying recommendations
        const minPagesVisited = 3;
        const minSongsClicked = 2;

        // Check if thresholds are met
        const totalPagesVisited = Object.values(userBehavior.pagesVisited).reduce((a, b) => a + b, 0);
        const totalSongsClicked = Object.values(userBehavior.clicks).reduce((a, b) => a + b, 0);

        if(totalPagesVisited < minPagesVisited || totalSongsClicked < minSongsClicked){
            console.log("Not enough user interactions yet. Recommendations will not be shown.");
            return;
        }

        // Define a delay before showing the recommendation
        const delay = 5000; // 5 seconds
        console.log("Triggering recommendation in", delay, "ms");
        setTimeout(() => {
            const currentPageGenres = getGenresFromSchema();
            console.log("Current page genres:", currentPageGenres);
            const recommendedSong = recommendSong(currentPageGenres);
            console.log("Recommended song:", recommendedSong);
            if(recommendedSong){
                showRecommendation(recommendedSong);
            }
        }, delay);
    }

    /**
     * Reset the recommendation flag after 24 hours.
     * This allows recommendations to be shown again after a day.
     */
    function resetRecommendationFlag(){
        sessionStorage.removeItem("lastRecommendationShown");
        console.log("Recommendation flag reset.");
    }

    /**
     * Initialize the recommendation system by loading user behavior,
     * tracking the current page, setting up click tracking, and triggering recommendations.
     */
    function initialize(){
        loadUserBehavior();
        window.pageStartTime = Date.now(); // Start tracking time on page
        trackPageVisit();
        setupClickTracking();
        triggerRecommendation();
        window.addEventListener("beforeunload", trackTimeSpent);
        // Set timeout to reset the recommendation flag every 24 hours
        setTimeout(resetRecommendationFlag, 24 * 60 * 60 * 1000); // 24 hours
    }

    // Start the initialization process
    initialize();
});
