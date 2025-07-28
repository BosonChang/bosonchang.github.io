var dropped = false;

function dropDown() {
    const navli = document.getElementById("navlist");
    if (window.innerWidth <= window.innerHeight) {
        if (!dropped) {
            navli.style.display = "flex";
        } else {
            navli.style.display = "none";
        }
        dropped = !dropped;
    }

}
window.addEventListener("resize", checkSize);
function checkSize() {
    const navli = document.getElementById("navlist");
    if (window.innerWidth > window.innerHeight) {
        navli.style.display = "flex";
        dropped = true;
    } else {
        navli.style.display = "none";
        dropped = false;
    }
}