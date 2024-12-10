// Function to load player data from a JSON file
function loadPlayersData() {
    fetch('players.json')
    .then(response => response.json())
    .then(data => sortByRating(data))
    .catch(error => console.error('Error loading the player data:', error));
}

// Sorting function
function sortByRating(players) {
    players.sort((a, b) => b.rating - a.rating); // Sort by rating in descending order
    generateContent(players);
}

// Function to generate table content
function generateContent(players) {
    var contentArea = document.getElementById('playersRatingList');
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

// function loadMatchesData() {
//     fetch('matches.json')
//         .then(response => response.json())
//         .then(data => displayMatchData(data))
//         .catch(error => console.error('Error loading match histories: ', error));
// }

// function displayMatchData(matches) {
//     var contentArea = document.getElementById('matchHistoryList');
//     contentArea.innerHTML = ''; // Clear previous content

//     matches.forEach((match, index) => {
//         var tableRow = document.createElement('tr');

//         // Set row colors: alternating between gray and dark gray
//         tableRow.style.backgroundColor = index % 2 === 0 ? 'gray' : 'darkgray';

//         var tableItem_Player1 = document.createElement('td');
//         var tableItem_Player2 = document.createElement('td');
//         var tableItem_Score = document.createElement('td');
//         tableItem_Player1.textContent = match.player1;
//         tableItem_Player2.textContent = match.player2;
//         tableItem_Score.textContent = match.player1Score + ":" + match.player2Score;

//         tableRow.appendChild(tableItem_Player1);
//         tableRow.appendChild(tableItem_Score);
//         tableRow.appendChild(tableItem_Player2);

//         contentArea.appendChild(tableRow);
//     });
// }

// Initial display
window.onload = function () {
    loadPlayersData();
    //loadMatchesData();
};
