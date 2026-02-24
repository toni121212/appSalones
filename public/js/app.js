document.addEventListener("DOMContentLoaded", async () => {

  // 🚫 No validar sesión en login
  if (location.pathname.includes("login.html")) return;

  const res = await fetch("/api/me");
  const data = await res.json();

  // 🔒 Si no hay sesión → login
  if (!data.user) {
    location.href = "/login.html";
    return;
  }

  // 👤 Mostrar usuario en navbar si existe
  const navUser = document.getElementById("navUser");
  if (navUser) {
    navUser.textContent = `${data.user.name} (${data.user.role})`;
  }

  // 👋 Logout global
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await fetch("/api/logout", { method: "POST" });
      location.href = "/login.html";
    });
  }

  // 🔐 CONTROL ADMIN
  const adminElements = document.querySelectorAll(".only-admin");

  if (data.user.role === "admin") {
    // Mostrar elementos admin
    adminElements.forEach(el => {
      el.style.display = "block";
    });
  } else {
    // Ocultar elementos admin
    adminElements.forEach(el => {
      el.style.display = "none";
    });

    // 🔒 Bloquear acceso directo a páginas admin
    if (
      location.pathname.includes("admin") ||
      location.pathname.includes("reportes") ||
      location.pathname.includes("crear_usuario")
    ) {
      location.href = "/dashboard.html";
    }
  }

});