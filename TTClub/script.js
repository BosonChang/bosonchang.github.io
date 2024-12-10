// Function to generate table content
function generateContent(players) {
    var contentArea = document.getElementById('content-area');
    contentArea.innerHTML = ''; // Clear previous content

    players.forEach((player, index) => {
        var tableRow = document.createElement('tr');

        // Set row colors: alternating between gray and dark gray
        tableRow.style.backgroundColor = index % 2 === 0 ? 'gray' : 'darkgray';

        var tableItem_PlayerName = document.createElement('td');
        var tableItem_PlayerRating = document.createElement('td');
        tableItem_PlayerName.textContent = player.name;
        tableItem_PlayerRating.textContent = player.rating;

        tableRow.appendChild(tableItem_PlayerName);
        tableRow.appendChild(tableItem_PlayerRating);

        contentArea.appendChild(tableRow);
    });
}

// Sorting function
function sortByRating(players) {
    players.sort((a, b) => b.rating - a.rating); // Sort by rating in descending order
    generateContent(players);
}

// Function to load player data from a JSON file
function loadPlayerData() {
    fetch('players.json')
    .then(response => response.json())
    .then(data => sortByRating(data))
    .catch(error => console.error('Error loading the player data:', error));
}

// Initial display
window.onload = function () {
    loadPlayerData();
};
