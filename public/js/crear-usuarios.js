document.addEventListener("DOMContentLoaded", () => {
  const createForm = document.getElementById("createUserForm");
  const msg = document.getElementById("msg");
  const listMsg = document.getElementById("listMsg");
  const rows = document.getElementById("usersRows");
  const btnRecargar = document.getElementById("btnRecargar");

  const editModalEl = document.getElementById("editUserModal");
  const editModal = new bootstrap.Modal(editModalEl);
  const editForm = document.getElementById("editUserForm");
  const editMsg = document.getElementById("editMsg");

  let usuariosCache = [];

  function showMsg(el, type, text) {
    el.className = `alert alert-${type} mt-3`;
    el.textContent = text;
  }

  function clearMsg(el) {
    el.className = "";
    el.textContent = "";
  }

  async function loadUsers() {
    try {
      rows.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Cargando...</td></tr>`;
      clearMsg(listMsg);

      const res = await fetch("/api/users");
      const data = await res.json();

      if (!res.ok) {
        rows.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar usuarios</td></tr>`;
        showMsg(listMsg, "danger", data.error || "Error al cargar usuarios");
        return;
      }

      usuariosCache = data;

      if (!Array.isArray(data) || data.length === 0) {
        rows.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay usuarios registrados</td></tr>`;
        return;
      }

      rows.innerHTML = data.map(u => `
        <tr>
          <td>${u.id}</td>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td><span class="badge ${u.role === "admin" ? "bg-danger" : "bg-primary"}">${u.role}</span></td>
          <td class="text-center">
            <button class="btn btn-sm btn-warning me-1 btn-editar" data-id="${u.id}">Editar</button>
            <button class="btn btn-sm btn-danger btn-eliminar" data-id="${u.id}" data-name="${u.name}">Eliminar</button>
          </td>
        </tr>
      `).join("");

      // Eventos editar
      document.querySelectorAll(".btn-editar").forEach(btn => {
        btn.addEventListener("click", () => openEditModal(Number(btn.dataset.id)));
      });

      // Eventos eliminar
      document.querySelectorAll(".btn-eliminar").forEach(btn => {
        btn.addEventListener("click", () => eliminarUsuario(Number(btn.dataset.id), btn.dataset.name));
      });

    } catch (err) {
      console.error(err);
      rows.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error de conexión</td></tr>`;
      showMsg(listMsg, "danger", "Error de conexión al cargar usuarios");
    }
  }

  function openEditModal(id) {
    const u = usuariosCache.find(x => Number(x.id) === Number(id));
    if (!u) return;

    clearMsg(editMsg);

    document.getElementById("edit_id").value = u.id;
    document.getElementById("edit_name").value = u.name || "";
    document.getElementById("edit_email").value = u.email || "";
    document.getElementById("edit_role").value = u.role || "user";
    document.getElementById("edit_password").value = "";

    editModal.show();
  }

  async function eliminarUsuario(id, name) {
    const ok = confirm(`¿Seguro que deseas eliminar al usuario "${name}"?`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        showMsg(listMsg, "danger", data.error || "No se pudo eliminar el usuario");
        return;
      }

      showMsg(listMsg, "success", "✅ Usuario eliminado correctamente");
      await loadUsers();
    } catch (err) {
      console.error(err);
      showMsg(listMsg, "danger", "Error de conexión al eliminar usuario");
    }
  }

  // Crear usuario
  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg(msg);

    const body = {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value,
      role: document.getElementById("role").value
    };

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        showMsg(msg, "danger", data.error || "Error al crear usuario");
        return;
      }

      showMsg(msg, "success", "✅ Usuario creado correctamente");
      createForm.reset();
      await loadUsers();
    } catch (err) {
      console.error(err);
      showMsg(msg, "danger", "Error de conexión al crear usuario");
    }
  });

  // Guardar edición
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg(editMsg);

    const id = Number(document.getElementById("edit_id").value);

    const body = {
      name: document.getElementById("edit_name").value.trim(),
      email: document.getElementById("edit_email").value.trim(),
      role: document.getElementById("edit_role").value,
      password: document.getElementById("edit_password").value // opcional
    };

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        showMsg(editMsg, "danger", data.error || "No se pudo actualizar");
        return;
      }

      showMsg(editMsg, "success", "✅ Usuario actualizado correctamente");

      setTimeout(async () => {
        editModal.hide();
        await loadUsers();
      }, 500);
    } catch (err) {
      console.error(err);
      showMsg(editMsg, "danger", "Error de conexión al actualizar usuario");
    }
  });

  btnRecargar?.addEventListener("click", loadUsers);

  loadUsers();
});