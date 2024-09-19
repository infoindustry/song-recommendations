function searchSongs() {
    const input = document.getElementById("search-input").value.toLowerCase();
    const results = document.getElementById("results");
    results.innerHTML = ""; // Очистка предыдущих результатов

    // Если поле ввода пусто, не показывать результаты
    if (!input) {
        return;
    }

    songs.forEach(song => {
        if (
            song.title.toLowerCase().includes(input) ||
            song.genres.toLowerCase().includes(input) ||
            song.spiritualMessage.toLowerCase().includes(input) ||
            song.spiritualNeeds.toLowerCase().includes(input) ||
            song.keywords.toLowerCase().includes(input)
        ) {
            const li = document.createElement("li");
            li.className = "song-card";

            // Создание секции информации о песне
            const songInfo = document.createElement("div");
            songInfo.className = "song-info";

            // Проверка наличия ссылки на страницу и оборачивание названия в ссылку, если она есть
            if (song.pageUrl) {
                songInfo.innerHTML = `<strong><a href="${song.pageUrl}" target="_blank" class="song-title-link">${song.title}</a></strong><p>${song.motto}</p><p>${song.spiritualNeeds}</p>`;
            } else {
                songInfo.innerHTML = `<strong>${song.title}</strong><p>${song.motto}</p><p>${song.spiritualNeeds}</p>`;
            }

            // Создание изображения обложки песни
            const img = document.createElement("img");
            img.className = "song-cover";
            img.src = song.coverImage || "https://via.placeholder.com/150"; // Замените на реальный URL дефолтной обложки, если необходимо
            img.alt = song.title;

            // Создание секции ссылок на сервисы
            const songLinks = document.createElement("div");
            songLinks.className = "song-links";
            if (song.playlist) {
                songLinks.innerHTML += `<a href="${song.playlist}" target="_blank">Playlist</a>`;
            }
            if (song.spotify) {
                songLinks.innerHTML += `<a href="${song.spotify}" target="_blank">Spotify</a>`;
            }
            if (song.appleMusic) {
                songLinks.innerHTML += `<a href="${song.appleMusic}" target="_blank">Apple Music</a>`;
            }
            if (song.youtube) {
                songLinks.innerHTML += `<a href="${song.youtube}" target="_blank">YouTube</a>`;
            }

            // Добавление элементов в карточку
            li.appendChild(img);
            li.appendChild(songInfo);
            li.appendChild(songLinks);
            results.appendChild(li);
        }
    });
}
