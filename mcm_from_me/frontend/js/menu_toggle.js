const menuButton = document.querySelector(".menu-button");
let menuFrame = null;

function closeMenu() {
  menuFrame?.remove();
  menuFrame = null;
  document.body.classList.remove("menu-open");
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.setAttribute("aria-label", "메뉴 열기");
  menuButton?.focus();
}

function openMenu() {
  const menuUrl = new URL(document.body.dataset.menuUrl, window.location.origin);
  menuUrl.searchParams.set("overlay", "1");
  menuFrame = document.createElement("iframe");
  menuFrame.className = "journey-menu-frame";
  menuFrame.src = menuUrl;
  menuFrame.title = "Journey menu";
  document.body.append(menuFrame);
  document.body.classList.add("menu-open");
  menuButton.setAttribute("aria-expanded", "true");
  menuButton.setAttribute("aria-label", "메뉴 닫기");
}

menuButton?.setAttribute("aria-expanded", "false");
menuButton?.addEventListener("click", () => {
  if (menuFrame) {
    closeMenu();
  } else {
    openMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuFrame) closeMenu();
});
