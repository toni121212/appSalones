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

  async function cargarResumen() {
    const r = await getJSON("/api/dashboard/resumen");

    document.getElementById("kpi_reportes").textContent = Number(r.total_reportes || 0);
    document.getElementById("kpi_ingresos").textContent = money(r.total_ingresos);
    document.getElementById("kpi_egresos").textContent = money(r.total_egresos);
    document.getElementById("kpi_utilidad").textContent = money(r.total_utilidad);
  }

  async function cargarUtilidadPorSalon() {
    const msgEl = document.getElementById("msgSalon");
    if (msgEl) msgEl.textContent = "";

    const allRows = await getJSON("/api/dashboard/utilidad-por-salon");
    const rows = allRows.filter(r => Number(r.total_reportes || 0) > 0);

    if (chartSalon) {
      chartSalon.destroy();
      chartSalon = null;
    }

    if (!rows.length) {
      if (msgEl) msgEl.textContent = "No hay datos para mostrar.";
      return;
    }

    const labels = rows.map(r => r.salon);
    const dataUtilidad = rows.map(r => Number(r.total_utilidad || 0));

    const ctx = document.getElementById("chartUtilidadSalon")?.getContext("2d");
    if (!ctx) return;

    chartSalon = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "Utilidad", data: dataUtilidad }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  async function cargarTendencia() {
    const msgEl = document.getElementById("msgTendencia");
    if (msgEl) msgEl.textContent = "";

    const dias = Number(diasEl?.value || 7);
    const data = await getJSON(`/api/dashboard/tendencia?dias=${dias}`);
    const rows = Array.isArray(data.rows) ? data.rows : [];

    if (chartTendencia) {
      chartTendencia.destroy();
      chartTendencia = null;
    }

    if (!rows.length) {
      if (msgEl) msgEl.textContent = "No hay datos para mostrar en el rango seleccionado.";
      return;
    }

    const labels = rows.map(r => r.fecha);
    const ingresos = rows.map(r => Number(r.total_ingresos || 0));
    const egresos = rows.map(r => Number(r.total_egresos || 0));
    const utilidad = rows.map(r => Number(r.total_utilidad || 0));

    const ctx = document.getElementById("chartTendencia")?.getContext("2d");
    if (!ctx) return;

    chartTendencia = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Ingresos", data: ingresos },
          { label: "Egresos", data: egresos },
          { label: "Utilidad", data: utilidad }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  async function cargarDashboardAdmin() {
    await Promise.all([
      cargarResumen(),
      cargarUtilidadPorSalon(),
      cargarTendencia()
    ]);
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