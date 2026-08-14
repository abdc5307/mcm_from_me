document.querySelector("[data-retry-url]")?.addEventListener("click", (event) => {
  window.location.assign(event.currentTarget.dataset.retryUrl);
});
