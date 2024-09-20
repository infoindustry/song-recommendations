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
     * The card appears from the left side and can be clicked to fully expand.
     * @param {Object} recommendedSong - The song object to be recommended.
     */
    function showRecommendation(recommendedSong){
        console.log("showRecommendation called with song:", recommendedSong);

        // Check if recommendation is already shown
        if(sessionStorage.getItem("songRecommendationShown")){
            console.log("Recommendation already shown on this page.");
            return;
        }

        // Create recommendation container
        const container = document.createElement("div");
        container.id = "song-recommendation-container";
        container.style.position = "fixed";
        container.style.top = "50%";
        container.style.left = "0";
        container.style.transform = "translate(-100%, -50%)"; // Initially hidden off-screen
        container.style.transition = "transform 0.5s ease";
        container.style.zIndex = "1001";
        container.style.cursor = "pointer";

        // Create recommendation card
        const card = document.createElement("div");
        card.id = "song-recommendation-card";
        card.style.backgroundColor = "#242424"; // Updated background color
        card.style.padding = "20px";
        card.style.borderRadius = "10px";
        card.style.width = "400px"; // Increased size
        card.style.color = "#FFFFFF";
        card.style.display = "flex";
        card.style.flexDirection = "row";
        card.style.alignItems = "center";
        card.style.boxShadow = "2px 2px 10px rgba(0, 0, 0, 0.3)";
        card.style.transition = "transform 0.3s ease, width 0.3s ease";
        card.style.position = "relative";
        card.style.boxSizing = "border-box";

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
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent triggering container's click
            document.body.removeChild(container);
            sessionStorage.setItem("songRecommendationShown", "true");
            console.log("Recommendation closed by user.");
        });

        // Informative message
        const infoMessage = document.createElement("p");
        infoMessage.textContent = "We think you'll like this!";
        infoMessage.style.margin = "0 0 10px 0";
        infoMessage.style.fontSize = "14px";
        infoMessage.style.color = "#AAAAAA";

        // Song image
        const img = document.createElement("img");
        img.src = recommendedSong.coverImage || "https://via.placeholder.com/100";
        img.alt = recommendedSong.title;
        img.style.width = "100px";
        img.style.height = "100px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "10px";
        img.style.marginRight = "15px";

        // Song details container
        const details = document.createElement("div");
        details.style.flexGrow = "1";
        details.style.display = "flex";
        details.style.flexDirection = "column";
        details.style.justifyContent = "center";

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
         * Helper function to create styled link buttons.
         * @param {string} url - The URL the button should link to.
         * @param {string} text - The display text of the button.
         * @param {string} bgColor - The background color of the button.
         * @returns {HTMLElement} - The created anchor element styled as a button.
         */
        function createLinkButton(url, text, bgColor){
            const link = document.createElement("a");
            link.href = url;
            link.target = "_blank";
            link.textContent = text;
            link.style.backgroundColor = bgColor;
            link.style.color = "#FFFFFF";
            link.style.padding = "8px 12px";
            link.style.borderRadius = "5px";
            link.style.textDecoration = "none";
            link.style.fontSize = "12px";
            link.style.textAlign = "center";
            link.style.flex = "1 1 auto";
            return link;
        }

        // Add link buttons if URLs are present
        if(recommendedSong.playlist){
            const playlistLink = createLinkButton(recommendedSong.playlist, "Playlist", "#be3c10");
            buttonsDiv.appendChild(playlistLink);
        }
        if(recommendedSong.spotify){
            const spotifyLink = createLinkButton(recommendedSong.spotify, "Spotify", "#1DB954");
            buttonsDiv.appendChild(spotifyLink);
        }
        if(recommendedSong.appleMusic){
            const appleLink = createLinkButton(recommendedSong.appleMusic, "Apple Music", "#FA233B");
            buttonsDiv.appendChild(appleLink);
        }
        if(recommendedSong.youtube){
            const youtubeLink = createLinkButton(recommendedSong.youtube, "YouTube", "#FF0000");
            buttonsDiv.appendChild(youtubeLink);
        }
        if(recommendedSong.pageUrl){
            const pageLink = createLinkButton(recommendedSong.pageUrl, "See on Website", "#007BFF");
            buttonsDiv.appendChild(pageLink);
        }

        // Append title and motto to details
        details.appendChild(title);
        details.appendChild(motto);
        details.appendChild(buttonsDiv);

        // Append info message, image, and details to card
        card.appendChild(closeBtn);
        card.appendChild(infoMessage);
        card.appendChild(img);
        card.appendChild(details);

        // Append card to container
        container.appendChild(card);

        // Append container to body
        document.body.appendChild(container);

        // Trigger the slide-in animation after a slight delay to ensure transition
        setTimeout(() => {
            container.style.transform = "translate(0, -50%)"; // Slide in
        }, 100); // 100ms delay

        /**
         * Handle click on the recommendation container to expand or collapse.
         * When expanded, the card rearranges its layout for better visibility.
         */
        container.addEventListener("click", function(){
            if(container.classList.contains("expanded")){
                // Collapse the card back to partial view
                container.style.transform = "translate(-100%, -50%)";
                container.classList.remove("expanded");
                // Reset card styles to original state
                card.style.flexDirection = "row";
                card.style.width = "400px";
                infoMessage.style.display = "block";
            } else {
                // Expand the card fully into view
                container.style.transform = "translate(0, -50%)";
                container.classList.add("expanded");
                // Modify styles for expanded view
                card.style.flexDirection = "column";
                card.style.width = "500px"; // Increased size for expanded view
                infoMessage.style.display = "none"; // Hide the message when expanded
            }
        });

        // Prevent clicking inside the card from triggering the container's click event
        card.addEventListener("click", function(event){
            event.stopPropagation();
        });

        // Set flag to not show recommendation again on this page
        sessionStorage.setItem("songRecommendationShown", "true");
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
        sessionStorage.removeItem("songRecommendationShown");
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
