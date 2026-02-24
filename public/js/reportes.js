document.addEventListener("DOMContentLoaded", async () => {
  function money(x){ return Number(x || 0).toFixed(2); }

  async function loadSalones(){
    const res = await fetch("/api/salones");
    const salones = await res.json();
    const sel = document.getElementById("salon_id");

    sel.innerHTML = `<option value="">(Todos)</option>` +
      salones.map(s => `<option value="${s.id}">${s.nombre}</option>`).join("");
  }

  async function eliminarReporte(id){
    const ok = confirm("¿Seguro que deseas eliminar este reporte?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/registros/${id}`, {
        method: "DELETE"
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "No se pudo eliminar el reporte");
        return;
      }

      alert("Reporte eliminado correctamente");
      await buscar(); // recargar tabla
    } catch (err) {
      console.error(err);
      alert("Error de conexión al eliminar el reporte");
    }
  }

  async function buscar(){
    const qs = new URLSearchParams();

    const salon_id = document.getElementById("salon_id").value;
    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;

    if (salon_id) qs.set("salon_id", salon_id);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);

    const res = await fetch("/api/registros?" + qs.toString());
    const data = await res.json();

    let ti = 0, te = 0, u = 0;

    document.getElementById("rows").innerHTML =
      data.map(r => {
        ti += Number(r.total_ingresos || 0);
        te += Number(r.total_egresos || 0);
        u  += Number(r.utilidad || 0);

        return `
          <tr>
            <td>${r.fecha}</td>
            <td>${r.salon}</td>
            <td>${r.creado_por_nombre || "Desconocido"}</td>
            <td class="text-end">$${money(r.total_ingresos)}</td>
            <td class="text-end">$${money(r.total_egresos)}</td>
            <td class="text-end">$${money(r.utilidad)}</td>
            <td class="text-center">
              <button class="btn btn-sm btn-danger btn-eliminar" data-id="${r.id}">
                Eliminar
              </button>
            </td>
          </tr>
        `;
      }).join("");

    // Eventos de botones eliminar
    document.querySelectorAll(".btn-eliminar").forEach(btn => {
      btn.addEventListener("click", () => eliminarReporte(btn.dataset.id));
    });

    document.getElementById("ti").textContent = money(ti);
    document.getElementById("te").textContent = money(te);
    document.getElementById("u").textContent  = money(u);
  }

  document.getElementById("buscar").onclick = buscar;

  await loadSalones();
  await buscar();
});