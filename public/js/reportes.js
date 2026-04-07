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
  <button class="btn btn-sm btn-info btn-detalle" data-id="${r.id}">
    Ver
  </button>
  <button class="btn btn-sm btn-danger btn-eliminar" data-id="${r.id}">
    Eliminar
  </button>
</td>
          </tr>
        `;
      }).join("");
// Evento botones ver detalle
document.querySelectorAll(".btn-detalle").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.id;
    const registro = data.find(r => r.id == id);
    mostrarDetalle(registro);
  });
});
function mostrarDetalle(r){
  const money = (x)=> Number(x || 0).toFixed(2);

  const html = `
    <div class="row">
      <div class="col-md-6">
        <p><b>Fecha:</b> ${r.fecha}</p>
        <p><b>Salón:</b> ${r.salon}</p>
        <p><b>Usuario:</b> ${r.creado_por_nombre || "Desconocido"}</p>
        <p><b>Cliente:</b> ${r.cliente_nombre || "N/A"}</p>
        <p><b>Teléfono:</b> ${r.cliente_numero || "N/A"}</p>
      </div>
      <div class="col-md-6">
        <p><b>Total ingresos:</b> $${money(r.total_ingresos)}</p>
        <p><b>Total egresos:</b> $${money(r.total_egresos)}</p>
        <p><b>Utilidad:</b> $${money(r.utilidad)}</p>
      </div>
    </div>

    <hr>

    <h6>Ingresos</h6>
    <ul>
      <li>Paquete: $${money(r.paquete)}</li>
      <li>Talón: $${money(r.talon)}</li>
      <li>Extra: $${money(r.extra)}</li>
    </ul>

    <h6>Egresos</h6>
    <ul>
      <li>Comisión: $${money(r.comision)}</li>
      <li>Gasto: $${money(r.gasto)}</li>
      <li>Sueldo 1: $${money(r.sueldo1)}</li>
      <li>Sueldo 2: $${money(r.sueldo2)}</li>
      <li>Sueldo 3: $${money(r.sueldo3)}</li>
      <li>Sueldo 4: $${money(r.sueldo4)}</li>
    </ul>
  `;

  document.getElementById("detalleContenido").innerHTML = html;

  const modal = new bootstrap.Modal(document.getElementById("detalleModal"));
  modal.show();
}
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