document.addEventListener("DOMContentLoaded", async () => {
  const userEl = document.getElementById("user");
  const adminForm = document.getElementById("adminForm");
  const formInfoSalon = document.getElementById("formInfoSalon");
  const salonSelect = document.getElementById("salon_id");
  const comisionInput = document.getElementById("comision");
  const infoInput = document.getElementById("info");
  const accordion = document.getElementById("accordionSalones");
  const sinDatos = document.getElementById("sinDatos");

  let currentUser = null;
  let salonesInfo = [];

  function money(x) {
    return Number(x || 0).toFixed(2);
  }

  function textoSeguro(texto) {
    return String(texto || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function textoConSaltos(texto) {
    return textoSeguro(texto).replaceAll("\n", "<br>");
  }

  async function getJSON(url) {
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Error en la petición");
    }

    return data;
  }

  async function cargarUsuario() {
    const data = await getJSON("/api/me");

    if (!data.user) {
      window.location.href = "/login.html";
      return;
    }

    currentUser = data.user;
    userEl.textContent = `Hola ${currentUser.name} (${currentUser.role})`;

    if (currentUser.role === "admin") {
      adminForm.classList.remove("d-none");
    }
  }

  async function cargarInfoSalones() {
    salonesInfo = await getJSON("/api/salon-info");

    accordion.innerHTML = "";

    if (!salonesInfo.length) {
      sinDatos.classList.remove("d-none");
      return;
    }

    sinDatos.classList.add("d-none");

    salonesInfo.forEach((s, index) => {
      const item = document.createElement("div");
      item.className = "accordion-item";

      const collapseId = `collapseSalon${s.salon_id}`;
      const headingId = `headingSalon${s.salon_id}`;

      const tieneInfo = s.info && s.info.trim() !== "";
      const textoInfo = tieneInfo
        ? textoConSaltos(s.info)
        : `<span class="text-muted">No hay información registrada para este salón.</span>`;

      const botonesAdmin = currentUser?.role === "admin"
        ? `
          <div class="mt-3 d-flex gap-2">
            <button class="btn btn-warning btn-sm btn-editar" data-id="${s.salon_id}">
              Editar
            </button>

            <button class="btn btn-danger btn-sm btn-eliminar" data-id="${s.salon_id}">
              Eliminar info
            </button>
          </div>
        `
        : "";

      item.innerHTML = `
        <h2 class="accordion-header" id="${headingId}">
          <button class="accordion-button ${index === 0 ? "" : "collapsed"}" type="button"
            data-bs-toggle="collapse"
            data-bs-target="#${collapseId}">
            ${textoSeguro(s.salon)}
          </button>
        </h2>

        <div id="${collapseId}" class="accordion-collapse collapse ${index === 0 ? "show" : ""}"
          data-bs-parent="#accordionSalones">

          <div class="accordion-body">
            <p class="mb-2">
              <b>Comisión:</b> $${money(s.comision)}
            </p>

            <p class="mb-1"><b>Información:</b></p>

            <div class="border rounded p-3 bg-light">
              ${textoInfo}
            </div>

            ${botonesAdmin}
          </div>
        </div>
      `;

      accordion.appendChild(item);
    });

    document.querySelectorAll(".btn-editar").forEach(btn => {
      btn.addEventListener("click", () => cargarEnFormulario(btn.dataset.id));
    });

    document.querySelectorAll(".btn-eliminar").forEach(btn => {
      btn.addEventListener("click", () => eliminarInfo(btn.dataset.id));
    });
  }

  function cargarSelectSalones() {
    salonSelect.innerHTML = `<option value="">Selecciona un salón</option>` +
      salonesInfo.map(s => `
        <option value="${s.salon_id}">
          ${textoSeguro(s.salon)}
        </option>
      `).join("");
  }

  function cargarEnFormulario(salonId) {
    const salon = salonesInfo.find(s => String(s.salon_id) === String(salonId));

    if (!salon) return;

    salonSelect.value = salon.salon_id;
    comisionInput.value = salon.comision || 0;
    infoInput.value = salon.info || "";

    adminForm.scrollIntoView({ behavior: "smooth" });
  }

  async function guardarInfo(e) {
    e.preventDefault();

    if (currentUser?.role !== "admin") {
      alert("No tienes permisos para editar esta información");
      return;
    }

    const body = {
      salon_id: salonSelect.value,
      comision: comisionInput.value,
      info: infoInput.value
    };

    const res = await fetch("/api/salon-info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error al guardar información");
      return;
    }

    alert("Información guardada correctamente");

    formInfoSalon.reset();

    await cargarInfoSalones();
    cargarSelectSalones();
  }

  async function eliminarInfo(salonId) {
    if (currentUser?.role !== "admin") {
      alert("No tienes permisos para eliminar esta información");
      return;
    }

    const ok = confirm("¿Seguro que deseas eliminar la información de este salón?");
    if (!ok) return;

    const res = await fetch(`/api/salon-info/${salonId}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error al eliminar información");
      return;
    }

    alert("Información eliminada correctamente");

    await cargarInfoSalones();
    cargarSelectSalones();
  }

  formInfoSalon.addEventListener("submit", guardarInfo);

  await cargarUsuario();
  await cargarInfoSalones();

  if (currentUser?.role === "admin") {
    cargarSelectSalones();
  }
});