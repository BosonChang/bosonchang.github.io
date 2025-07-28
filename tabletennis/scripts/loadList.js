document.addEventListener('DOMContentLoaded', () => {
    fetch('data/videos.json')
        .then(response => response.json())
        .then(posts => {
            const container = document.getElementById('content-area');
            posts.reverse().forEach((post, index) => {
                const postElement = document.createElement('div');
                postElement.className = 'post';
                postElement.innerHTML = `
                <iframe src="https://www.youtube.com/embed/${post.contentID}" allowfullscreen></iframe>
          <div class="text-section">
            <h2>${post.title} ${post.favorite ? '⭐' : ''} </h2>
            <h4>${post.date}</h4>
            <p>${post.notes}</p>
          </div>
        `;
                container.appendChild(postElement);
            });
        })
        .catch(error => {
            console.error('Error loading posts:', error);
        });
});
