document.addEventListener("DOMContentLoaded", async () => {

  const list = document.getElementById("list");
  const form = document.getElementById("f");
  const msg = document.getElementById("msg");

  // 🔐 Verificar que sea admin
  async function requireAdmin(){
    const res = await fetch("/api/me");
    const data = await res.json();

    if(!data.user) location.href="/login.html";
    if(data.user.role !== "admin") location.href="/dashboard.html";
  }

  // 📋 Cargar todos los salones (activos e inactivos)
  async function load(){
    const res = await fetch("/api/salones/all");
    const salones = await res.json();

    list.innerHTML = salones.map(s => `
      <div class="card mb-3 shadow-sm p-3">
        <div class="d-flex justify-content-between align-items-center gap-3">

          <div class="w-100">
            <input 
              class="form-control"
              value="${s.nombre}" 
              id="input-${s.id}"
              ${s.activo ? "" : "disabled"}
            />

            <span class="badge mt-2 ${s.activo ? "bg-success" : "bg-danger"}">
              ${s.activo ? "Activo" : "Desactivado"}
            </span>
          </div>

          <div class="d-flex flex-column gap-2">
            ${s.activo ? `
              <button class="btn btn-success btn-sm" onclick="updateSalon(${s.id})">
                Guardar
              </button>

              <button class="btn btn-danger btn-sm" onclick="deleteSalon(${s.id})">
                Desactivar
              </button>
            ` : `
              <button class="btn btn-warning btn-sm" onclick="reactivarSalon(${s.id})">
                Reactivar
              </button>
            `}
          </div>

        </div>
      </div>
    `).join("");
  }

  // ✏️ Actualizar salón
  window.updateSalon = async (id) => {
    const nombre = document.getElementById(`input-${id}`).value.trim();

    if(!nombre){
      alert("El nombre no puede estar vacío");
      return;
    }

    const res = await fetch(`/api/salones/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre })
    });

    if(!res.ok){
      alert("Error al actualizar");
      return;
    }

    alert("Salón actualizado correctamente");
    load();
  };

  // ❌ Desactivar salón
  window.deleteSalon = async (id) => {
    if(!confirm("¿Desactivar salón?")) return;

    const res = await fetch(`/api/salones/${id}`, {
      method: "DELETE"
    });

    if(!res.ok){
      alert("Error al desactivar");
      return;
    }

    load();
  };

  // 🔄 Reactivar salón
  window.reactivarSalon = async (id) => {
    if(!confirm("¿Reactivar salón?")) return;

    const res = await fetch(`/api/salones/${id}/reactivar`, {
      method: "PUT"
    });

    if(!res.ok){
      alert("Error al reactivar");
      return;
    }

    alert("Salón reactivado correctamente");
    load();
  };

  // ➕ Crear nuevo salón
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const body = Object.fromEntries(new FormData(form).entries());

    if(!body.nombre){
      msg.textContent = "El nombre es obligatorio";
      msg.classList.add("text-danger");
      return;
    }

    const res = await fetch("/api/salones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if(!res.ok){
      msg.textContent = "Error al crear el salón (quizá ya exista)";
      msg.classList.add("text-danger");
      return;
    }

    msg.textContent = "Salón creado correctamente";
    msg.classList.remove("text-danger");
    msg.classList.add("text-success");

    form.reset();
    load();
  });

  // 🚀 Inicializar
  await requireAdmin();
  load();
});