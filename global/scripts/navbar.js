// Load Navbar
document.addEventListener("DOMContentLoaded", () => {
  fetch("../navbar.html")
    .then(response => response.text())
    .then(data => {
      document.getElementById("navbar").innerHTML = data;
    })
    .catch(error => console.error("Failed to load navbar:", error));
});

// Navbar Behavior
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