document.addEventListener("DOMContentLoaded", function () {
    const listItems = document.querySelectorAll("#menu li");

    listItems.forEach(li => {
        const hr = document.createElement("hr");
        const hhr = document.createElement("hr");
        hhr.classList.add('hiddenhr');
        li.appendChild(hr);
        li.appendChild(hhr);
    });
});
