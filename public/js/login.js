document.addEventListener("DOMContentLoaded", () => {

  const msg = document.getElementById("msg");

  document.getElementById("loginForm")
    .addEventListener("submit", async (e) => {

      e.preventDefault();
      msg.classList.add("d-none");

      const body = Object.fromEntries(
        new FormData(e.target).entries()
      );

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || "Error";
        msg.classList.remove("d-none");
        return;
      }

      location.href = "/dashboard.html";
    });

});