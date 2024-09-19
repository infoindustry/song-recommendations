document.addEventListener("DOMContentLoaded", function() {
    const userBehavior = {
        pagesVisited: {},
        clicks: {},
        timeSpent: {}
    };

    // Функция для извлечения жанров из JSON-LD схемы
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
                console.error("Ошибка парсинга JSON-LD:", e);
            }
        }
        return genres;
    }

    // Загрузка сохранённого поведения пользователя из sessionStorage
    window.onload = function(){
        const storedBehavior = sessionStorage.getItem("userBehavior");
        if(storedBehavior){
            Object.assign(userBehavior, JSON.parse(storedBehavior));
            console.log("Загружено сохранённое поведение пользователя:", userBehavior);
        }

        window.pageStartTime = Date.now();

        trackPageVisit();
        setupClickTracking();
        triggerRecommendation();
    };

    // Получение текущего пути страницы
    function currentPage(){
        return window.location.pathname;
    }

    // Отслеживание посещения страницы
    function trackPageVisit(){
        const page = currentPage();
        userBehavior.pagesVisited[page] = (userBehavior.pagesVisited[page] || 0) + 1;
        console.log("Посещена страница:", page, "Общее количество посещений:", userBehavior.pagesVisited[page]);
        saveUserBehavior();
    }

    // Настройка отслеживания кликов по ссылкам на песни
    function setupClickTracking(){
        document.body.addEventListener("click", function(event) {
            let target = event.target;

            // Найти ближайший элемент <a>, если клик был по вложенному элементу
            while(target && target !== document.body && target.tagName !== 'A'){
                target = target.parentElement;
            }

            if(target && target.tagName === 'A'){
                const href = target.getAttribute('href');
                if(href){
                    const song = songs.find(s => s.pageUrl === href);
                    if(song){
                        trackClick(song.title);
                    }
                }
            }
        });
    }

    // Отслеживание клика по песне
    function trackClick(songTitle){
        if(userBehavior.clicks[songTitle]){
            userBehavior.clicks[songTitle] += 1;
        } else {
            userBehavior.clicks[songTitle] = 1;
        }
        console.log("Клик по песне:", songTitle, "Количество кликов:", userBehavior.clicks[songTitle]);
        saveUserBehavior();
    }

    // Сохранение поведения пользователя в sessionStorage
    function saveUserBehavior(){
        sessionStorage.setItem("userBehavior", JSON.stringify(userBehavior));
        console.log("Сохранено поведение пользователя:", userBehavior);
    }

    // Отслеживание времени, проведённого на странице
    window.addEventListener("beforeunload", function(){
        const timeSpent = Math.floor((Date.now() - window.pageStartTime) / 1000); // в секундах
        const page = currentPage();
        userBehavior.timeSpent[page] = (userBehavior.timeSpent[page] || 0) + timeSpent;
        console.log("Время на странице:", page, "Время (секунды):", timeSpent, "Общее время:", userBehavior.timeSpent[page]);
        saveUserBehavior();
    });

    // Функция рекомендации песни
    function recommendSong(currentPageGenres){
        const genreScores = {};
        const needScores = {};

        const publishedSongs = songs.filter(song => song.pageUrl);
        console.log("Опубликованные песни:", publishedSongs);

        // Оценка на основе кликов
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

        // Оценка на основе времени, проведённого на страницах
        for(const page in userBehavior.timeSpent){
            const time = userBehavior.timeSpent[page];
            const pageGenres = publishedSongs.filter(song => song.pageUrl === page).map(song => song.genres.toLowerCase().split(",").map(g => g.trim())).flat();
            pageGenres.forEach(genre => {
                genreScores[genre] = (genreScores[genre] || 0) + Math.floor(time / 60);
            });
        }
        console.log("Genre Scores после времени:", genreScores);

        // Оценка на основе текущих жанров страницы
        if(currentPageGenres.length > 0){
            currentPageGenres.forEach(genre => {
                genreScores[genre] = (genreScores[genre] || 0) + 3;
            });
        }
        console.log("Genre Scores после текущих жанров:", genreScores);

        // Определение топового жанра
        let finalTopGenre = null;
        let highestGenreScore = -1;
        for(const genre in genreScores){
            if(genreScores[genre] > highestGenreScore){
                highestGenreScore = genreScores[genre];
                finalTopGenre = genre;
            }
        }
        console.log("Top Genre:", finalTopGenre, "Score:", highestGenreScore);

        // Если нет топового жанра, выбрать случайную песню
        if(!finalTopGenre){
            const randomSong = publishedSongs[Math.floor(Math.random() * publishedSongs.length)];
            console.log("Рандомная песня:", randomSong);
            return randomSong;
        }

        // Найти песни, соответствующие топовому жанру
        const matchingSongs = publishedSongs.filter(song => song.genres.toLowerCase().split(",").map(g => g.trim()).includes(finalTopGenre));
        console.log("Matching Songs:", matchingSongs);

        // Если нет подходящих песен, выбрать случайную
        if(matchingSongs.length === 0){
            const randomSong = publishedSongs[Math.floor(Math.random() * publishedSongs.length)];
            console.log("Рандомная песня:", randomSong);
            return randomSong;
        }

        // Выбрать лучшую песню из matchingSongs на основе оценок
        let bestSong = null;
        let highestScore = -1;

        matchingSongs.forEach(song => {
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

        // Если по каким-то причинам bestSong не найден, выбрать случайную
        if(!bestSong){
            bestSong = matchingSongs[Math.floor(Math.random() * matchingSongs.length)];
            console.log("Рандомная песня из matchingSongs:", bestSong);
        }

        return bestSong;
    }

    // Функция отображения рекомендации
    function showRecommendation(recommendedSong){
        console.log("Функция showRecommendation вызвана с песней:", recommendedSong);
        
        // Проверка, была ли рекомендация уже показана на этой странице
        if(sessionStorage.getItem("songRecommendationShown")){
            console.log("Рекомендация уже показана на этой странице.");
            return;
        }

        // Создание оверлея
        const overlay = document.createElement("div");
        overlay.id = "song-recommendation-overlay";
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        overlay.style.display = "flex";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";
        overlay.style.zIndex = "1000";

        // Создание карточки рекомендации
        const card = document.createElement("div");
        card.id = "song-recommendation-card";
        card.style.backgroundColor = "#021124";
        card.style.padding = "20px";
        card.style.borderRadius = "10px";
        card.style.width = "90%";
        card.style.maxWidth = "400px";
        card.style.color = "#FFFFFF";
        card.style.position = "relative";
        card.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.3)";

        // Кнопка закрытия
        const closeBtn = document.createElement("span");
        closeBtn.innerHTML = "&times;";
        closeBtn.style.position = "absolute";
        closeBtn.style.top = "10px";
        closeBtn.style.right = "20px";
        closeBtn.style.fontSize = "30px";
        closeBtn.style.cursor = "pointer";
        closeBtn.addEventListener("click", () => {
            document.body.removeChild(overlay);
        });

        // Изображение песни
        const img = document.createElement("img");
        img.src = recommendedSong.coverImage || "https://via.placeholder.com/150";
        img.alt = recommendedSong.title;
        img.style.width = "100%";
        img.style.borderRadius = "10px";

        // Название песни
        const title = document.createElement("h2");
        title.textContent = recommendedSong.title;
        title.style.marginTop = "15px";

        // Девиз песни
        const motto = document.createElement("p");
        motto.textContent = recommendedSong.motto;
        motto.style.fontStyle = "italic";

        // Блок с ссылками
        const linksDiv = document.createElement("div");
        linksDiv.style.marginTop = "15px";
        linksDiv.style.display = "flex";
        linksDiv.style.flexWrap = "wrap";
        linksDiv.style.gap = "10px";

        // Функция для создания кнопок-ссылок
        function createLinkButton(url, text, bgColor){
            const link = document.createElement("a");
            link.href = url;
            link.target = "_blank";
            link.textContent = text;
            link.style.backgroundColor = bgColor;
            link.style.color = "#FFFFFF";
            link.style.padding = "10px";
            link.style.borderRadius = "5px";
            link.style.textDecoration = "none";
            link.style.flex = "1 1 calc(50% - 20px)";
            link.style.textAlign = "center";
            return link;
        }

        // Добавление кнопок-ссылок, если они существуют и опубликованы
        if(recommendedSong.playlist){
            const playlistLink = createLinkButton(recommendedSong.playlist, "Playlist", "#be3c10");
            linksDiv.appendChild(playlistLink);
        }
        if(recommendedSong.spotify){
            const spotifyLink = createLinkButton(recommendedSong.spotify, "Spotify", "#1DB954");
            linksDiv.appendChild(spotifyLink);
        }
        if(recommendedSong.appleMusic){
            const appleLink = createLinkButton(recommendedSong.appleMusic, "Apple Music", "#FA233B");
            linksDiv.appendChild(appleLink);
        }
        if(recommendedSong.youtube){
            const youtubeLink = createLinkButton(recommendedSong.youtube, "YouTube", "#FF0000");
            linksDiv.appendChild(youtubeLink);
        }
        if(recommendedSong.pageUrl){
            const pageLink = createLinkButton(recommendedSong.pageUrl, "See on our website", "#007BFF");
            linksDiv.appendChild(pageLink);
        }

        // Добавление элементов в карточку
        card.appendChild(closeBtn);
        card.appendChild(img);
        card.appendChild(title);
        card.appendChild(motto);
        card.appendChild(linksDiv);

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Установка флага, чтобы не показывать рекомендацию повторно на этой странице
        sessionStorage.setItem("songRecommendationShown", "true");
        console.log("Рекомендация показана:", recommendedSong.title);
    }

    // Функция запуска рекомендации с задержкой
    function triggerRecommendation(){
        const delay = 5000; // Задержка 5 секунд
        console.log("Запуск рекомендации через", delay, "мс");
        setTimeout(() => {
            const currentPageGenres = getGenresFromSchema();
            console.log("Текущие жанры страницы:", currentPageGenres);
            const recommendedSong = recommendSong(currentPageGenres);
            console.log("Рекомендованная песня:", recommendedSong);
            if(recommendedSong){
                showRecommendation(recommendedSong);
            }
        }, delay);
    }

    // Функция рекомендации может быть расширена для более сложной логики
});
