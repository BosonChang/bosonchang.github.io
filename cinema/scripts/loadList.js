document.addEventListener('DOMContentLoaded', () => {
    fetch('cinema/data/films.json')
        .then(response => response.json())
        .then(posts => {
            const container = document.getElementById('content-area');
            posts.reverse().forEach((post, index) => {
                const floatDirection = index % 2 === 0 ? 'right' : 'left';

                const postElement = document.createElement('div');
                postElement.className = 'post';
                postElement.innerHTML = `
          <hr>
          <div class="frame-container ${floatDirection}"><iframe src="https://www.youtube.com/embed/${post.contentID}" allowfullscreen></iframe></div>
          <div class="text-section">
            <div class="headline">
              <h2>${post.title}</h2>
              <div class="date">${post.date}</div>
            </div>
            <p class="logline">${post.logline}</p>
            <p lang="en" class="description">${post.description}</p>
          </div>
        `;
                container.appendChild(postElement);
            });
        })
        .catch(error => {
            console.error('Error loading posts:', error);
        });
});
