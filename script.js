function buildNavbar() {
    var container = document.createElement('nav');
    var unorderedList = document.createElement('ul');
    var lis = [];
    for (let i = 0; i < 5; i++){
        let li = document.createElement('li');
        lis.push(li);
    }

    var home = document.createElement('a');
    home.textContent = "Home";
    home.setAttribute("href", "/index.html")
    lis[0].appendChild(home);

    var sbuTableTennisClub = document.createElement('a');
    sbuTableTennisClub.textContent = "SBU Table Tennis Club";
    sbuTableTennisClub.setAttribute("href", "/TTClub/ratings.html")
    lis[1].appendChild(sbuTableTennisClub);

    lis.forEach(li => unorderedList.appendChild(li));
    container.appendChild(unorderedList);
    document.body.appendChild(container);
}

window.onload = function () {
    buildNavbar();
}