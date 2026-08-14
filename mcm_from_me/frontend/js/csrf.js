(function () {
  function getCookie(name) {
    const cookie = document.cookie
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
  }

  window.mcmCsrf = Object.freeze({
    getToken() {
      return getCookie("csrftoken");
    },
  });
})();
