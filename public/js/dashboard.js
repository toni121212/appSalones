document.addEventListener("DOMContentLoaded", async () => {
  const userEl = document.getElementById("user");
  const diasEl = document.getElementById("diasTendencia");
  const btnActualizar = document.getElementById("btnActualizarDashboard");

  let chartSalon = null;
  let chartTendencia = null;
  let currentUser = null;

  function money(x) {
    return `$${Number(x || 0).toFixed(2)}`;
  }

  async function getJSON(url) {
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      const err = new Error(data.error || `Error en ${url}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function ocultarSeccionAdminDashboard() {
    // Oculta accesos rápidos exclusivos de admin
    document.querySelectorAll(".quick-admin").forEach(el => el.classList.add("d-none"));

    // Oculta KPIs y gráficas
    document.getElementById("dashboardAdminSection")?.classList.add("d-none");
    document.getElementById("dashboardChartsSection")?.classList.add("d-none");

    // Oculta controles admin del encabezado
    document.getElementById("diasTendencia")?.classList.add("d-none");
    document.getElementById("btnActualizarDashboard")?.classList.add("d-none");
  }

  function mostrarMensajeUsuarioNormal() {
    const box = document.getElementById("dashboardUserInfo");
    if (!box) return;

    box.classList.remove("d-none");
    box.innerHTML = `
      <div class="alert alert-info mb-0">
        Bienvenido. Tu perfil no tiene acceso a reportes globales del dashboard.
        Usa los accesos rápidos para capturar registros.
      </div>
    `;
  }

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

      alert(err.message || "Error al cargar dashboard");
    } finally {
      if (btnActualizar && currentUser?.role === "admin") {
        btnActualizar.disabled = false;
      }
    }
  }

  btnActualizar?.addEventListener("click", async () => {
    if (currentUser?.role !== "admin") return;

    try {
      btnActualizar.disabled = true;
      await cargarDashboardAdmin();
    } catch (err) {
      console.error(err);
      if (err.status !== 403) {
        alert(err.message || "Error al actualizar dashboard");
      }
    } finally {
      btnActualizar.disabled = false;
    }
  });

  diasEl?.addEventListener("change", async () => {
    if (currentUser?.role !== "admin") return;

    try {
      await cargarTendencia();
    } catch (err) {
      console.error(err);
      if (err.status !== 403) {
        alert(err.message || "Error al cargar tendencia");
      }
    }
  });

  await init();
});