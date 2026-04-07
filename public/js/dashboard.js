document.addEventListener("DOMContentLoaded", async () => {
  const userEl = document.getElementById("user");
 
  let currentUser = null;

   async function cargarUsuario() {
    const data = await getJSON("/api/me");

    if (!data.user) {
      currentUser = null;
      userEl.textContent = "Sin sesión";
      return;
    }

    currentUser = data.user;
    userEl.textContent = `Hola ${data.user.name} (${data.user.role})`;

    // Mostrar accesos admin si corresponde
    if (data.user.role === "admin") {
      document.querySelectorAll(".quick-admin").forEach(el => {
        el.classList.remove("d-none");
      });
    }
  }

  
  
  async function init() {
    try {
      if (btnActualizar) btnActualizar.disabled = true;

      await cargarUsuario();

      // Sin sesión -> no seguir
      if (!currentUser) return;

      // Usuario normal -> ocultar todo lo de admin y no pedir endpoints admin
      if (currentUser.role !== "admin") {
        ocultarSeccionAdminDashboard();
        mostrarMensajeUsuarioNormal();
        return;
      }

      // Admin sí carga dashboard completo
      await cargarDashboardAdmin();

    } catch (err) {
      console.error("Error cargando dashboard:", err);

      // Si es por permisos, no mostrar alert molesto
      if (err.status === 403) {
        ocultarSeccionAdminDashboard();
        mostrarMensajeUsuarioNormal();
        return;
      }

    } finally {
      if (btnActualizar && currentUser?.role === "admin") {
        btnActualizar.disabled = false;
      }
    }
  }

 

  await init();
});