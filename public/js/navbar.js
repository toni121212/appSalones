document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Cargar navbar dinámicamente
    const navContainer = document.getElementById("navbar");
    if (!navContainer) return;

    const resHtml = await fetch("/components/navbar.html");
    if (!resHtml.ok) {
      console.error("No se pudo cargar /components/navbar.html");
      return;
    }

    navContainer.innerHTML = await resHtml.text();

    // Obtener sesión
    const res = await fetch("/api/me");
    const data = await res.json();

    if (!data.user) {
      location.href = "/login.html";
      return;
    }

    // Mostrar usuario (desktop + mobile)
    const txtUser = `${data.user.name} (${data.user.role})`;
    const navUser = document.getElementById("navUser");
    const navUserMobile = document.getElementById("navUserMobile");

    if (navUser) navUser.textContent = txtUser;
    if (navUserMobile) navUserMobile.textContent = txtUser;

    // Mostrar opciones solo admin (desktop)
    if (data.user.role === "admin") {
      document.getElementById("navReportes")?.classList.remove("d-none");
      document.getElementById("navSalones")?.classList.remove("d-none");
      document.getElementById("navUsuarios")?.classList.remove("d-none");

      // Mostrar opciones solo admin (mobile)
      document.getElementById("navReportesMobile")?.classList.remove("d-none");
      document.getElementById("navSalonesMobile")?.classList.remove("d-none");
      document.getElementById("navUsuariosMobile")?.classList.remove("d-none");
    }

    // Marcar link activo en desktop
    const path = window.location.pathname.toLowerCase();
    document.querySelectorAll(".navbar .nav-link").forEach(link => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      if (href && path.endsWith(href)) {
        link.classList.add("active");
      }
    });

    // Logout (desktop + mobile)
    const logout = async () => {
      try {
        await fetch("/api/logout", { method: "POST" });
      } catch (e) {
        console.error("Error al cerrar sesión:", e);
      } finally {
        location.href = "/login.html";
      }
    };

    document.getElementById("logoutBtn")?.addEventListener("click", logout);
    document.getElementById("logoutBtnMobile")?.addEventListener("click", logout);

    // Cerrar menú móvil al tocar una opción
    document.querySelectorAll('#nav .btn[href]').forEach(a => {
      a.addEventListener("click", () => {
        const collapseEl = document.getElementById("nav");
        if (collapseEl && window.bootstrap) {
          const instance =
            bootstrap.Collapse.getInstance(collapseEl) ||
            new bootstrap.Collapse(collapseEl, { toggle: false });
          instance.hide();
        }
      });
    });

  } catch (err) {
    console.error("Error en navbar.js:", err);
  }
});