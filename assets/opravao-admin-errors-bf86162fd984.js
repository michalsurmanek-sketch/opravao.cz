
window.addEventListener("error",function(e){var n=document.getElementById("loginMsg");if(n){n.textContent="Chyba skriptu administrace: "+(e.message||"neznámá chyba");n.classList.add("error")}});
