document.addEventListener("DOMContentLoaded", async () => {

  const f = document.getElementById("f");
  const msg = document.getElementById("msg");

  async function loadSalones(){
    const res = await fetch("/api/salones");
    const salones = await res.json();
    const sel = document.getElementById("salonSelect");
    sel.innerHTML = `<option value="">-- Selecciona salón --</option>` +
      salones.map(s => `<option value="${s.id}">${s.nombre}</option>`).join("");
  }

  function n(v){ return Number(v || 0); }

  function calc(){
    const get = (name)=> n(f.elements[name].value);

    const totalIngresos = get("paquete")+get("talon")+get("extra");
    const totalEgresos = get("comision")+get("gasto")+
                         get("sueldo1")+get("sueldo2")+
                         get("sueldo3")+get("sueldo4");

    const utilidad = totalIngresos-totalEgresos;

    document.getElementById("ti").textContent = totalIngresos.toFixed(2);
    document.getElementById("te").textContent = totalEgresos.toFixed(2);
    document.getElementById("u").textContent  = utilidad.toFixed(2);
  }

  document.querySelectorAll(".calc")
    .forEach(i => i.addEventListener("input", calc));

  f.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const body = Object.fromEntries(new FormData(f).entries());

    const res = await fetch("/api/registros",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if(!res.ok){
      msg.textContent = data.error || "Error";
      msg.className = "alert alert-danger mt-3";
      return;
    }

    msg.textContent = "✅ Guardado con ID " + data.id;
    msg.className = "alert alert-success mt-3";
    f.reset();
    calc();
  });

  await loadSalones();
  calc();


     const syncTotalsMirror = () => {
      const ti = document.getElementById("ti")?.textContent || "0.00";
      const te = document.getElementById("te")?.textContent || "0.00";
      const u  = document.getElementById("u")?.textContent || "0.00";

      const ti2 = document.getElementById("ti_copy");
      const te2 = document.getElementById("te_copy");
      const u2  = document.getElementById("u_copy");
      const utilidadWrap = document.getElementById("utilidadWrap");

      if (ti2) ti2.textContent = ti;
      if (te2) te2.textContent = te;
      if (u2) u2.textContent = u;

      const utilidadNum = Number(u);
      if (utilidadWrap) {
        utilidadWrap.classList.remove("positive", "negative");
        utilidadWrap.classList.add(utilidadNum < 0 ? "negative" : "positive");
      }
      if (u2?.parentElement) {
        u2.parentElement.classList.remove("positive", "negative");
        u2.parentElement.classList.add(utilidadNum < 0 ? "negative" : "positive");
      }
    };

    // Observa cambios de texto en totales generados por registros.js
    ["ti","te","u"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new MutationObserver(syncTotalsMirror);
      observer.observe(el, { childList: true, subtree: true, characterData: true });
    });

    // Ejecutar una vez al cargar
    window.addEventListener("load", syncTotalsMirror);
});