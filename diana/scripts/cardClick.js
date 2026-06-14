const card = document.getElementById('card')
const txtbox = document.getElementById('txtbox')
const unlock = document.getElementById('unlock')
const d = new Date()
let unlocked = false;

let state = false;

card.addEventListener("click", (event) => {
    if (event.target !== txtbox && event.target !== unlock) {
        state = !state;
        if (state) {
            card.style.transform = "rotateY(180deg)"
        } else {
            card.style.transform = "rotateY(0deg)"
        }
    }

    card.style.transition = "150ms"
})

unlock.addEventListener("click", (event) => { 
    let input = txtbox.value
    let target = card.querySelector(".card-back")
    if (input == d.getFullYear()+"0618") {
        unlocked = true

        // fade out card
        let opacity = 1
        let fadeOut = setInterval(() => {
            if (opacity <= 0) {
                card.remove()
                firework()
                open("https://c6.y.qq.com/base/fcgi-bin/u?__=aM9TCwdv7ISy")
                clearInterval(fadeOut);
                
                return;
            }
            opacity -= 0.02;
            target.style.opacity = opacity;
        }, 20);

        
    }
})

function firework() {
    // fade in firework
    let opacity = 0
    let target = document.getElementById("canvas")
    let target2 = document.getElementById("hbd")
    let fadeIn = setInterval(() => {
        if (opacity >= 1) {
            clearInterval(fadeIn);
            return;
        }
        opacity += 0.02;
        target.style.opacity = opacity;
        target2.style.opacity = opacity;

    }, 20);
}