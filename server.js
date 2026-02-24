const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./db");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: "cambia_esto_por_algo_largo",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true } // en prod: { secure: true } con https
  })
);

// --- Middlewares de seguridad
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "No autenticado" });
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: "No autenticado" });
    if (req.session.user.role !== role) return res.status(403).json({ error: "Sin permisos" });
    next();
  };
}

// --- Seed admin (solo si no existe) - corre 1 vez al arrancar
async function seedAdmin() {
  const email = "admin@admin.com";
  const pass = "123456"; // cámbialo después

  db.get("SELECT id FROM users WHERE email = ?", [email], async (err, row) => {
    if (err) {
      console.error("Error en seedAdmin:", err.message);
      return;
    }

    if (row) return;

    try {
      const hash = await bcrypt.hash(pass, 10);
      db.run(
        "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
        ["Administrador", email, hash, "admin"],
        function (err2) {
          if (err2) {
            console.error("Error creando admin:", err2.message);
            return;
          }
          console.log("✅ Admin creado:", email, pass);
        }
      );
    } catch (e) {
      console.error("Error hash admin:", e.message);
    }
  });
}
seedAdmin();

// --- Auth
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

    req.session.user = { id: user.id, name: user.name, role: user.role };
    res.json({ message: "OK", user: req.session.user });
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ message: "Logout" }));
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

// --- Admin: crear usuarios
app.post("/api/users", requireRole("admin"), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: "Faltan datos" });

  const hash = await bcrypt.hash(password, 10);
  db.run(
    "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
    [name, email, hash, role],
    function (err) {
      if (err) return res.status(400).json({ error: "Email ya existe o datos inválidos" });
      res.json({ id: this.lastID });
    }
  );
});

// --- Registros (ambos roles)
function calcTotals(body) {
  const n = (x) => Number(x || 0);
  const paquete = n(body.paquete), talon = n(body.talon), extra = n(body.extra);
  const comision = n(body.comision), gasto = n(body.gasto);
  const sueldo1 = n(body.sueldo1), sueldo2 = n(body.sueldo2), sueldo3 = n(body.sueldo3), sueldo4 = n(body.sueldo4);

  const total_ingresos = paquete + talon + extra;
  const total_egresos = comision + gasto + sueldo1 + sueldo2 + sueldo3 + sueldo4;
  const utilidad = total_ingresos - total_egresos;

  return { total_ingresos, total_egresos, utilidad };
}

app.post("/api/registros", requireAuth, (req, res) => {
  const { salon_id, fecha } = req.body;

  if (!salon_id || !fecha) return res.status(400).json({ error: "Salón y fecha son obligatorios" });

  const t = calcTotals(req.body);
  const u = req.session.user;

  const data = {
    salon_id, fecha,
    paquete: req.body.paquete || 0,
    talon: req.body.talon || 0,
    extra: req.body.extra || 0,
    comision: req.body.comision || 0,
    gasto: req.body.gasto || 0,
    sueldo1: req.body.sueldo1 || 0,
    sueldo2: req.body.sueldo2 || 0,
    sueldo3: req.body.sueldo3 || 0,
    sueldo4: req.body.sueldo4 || 0,
    ...t,
    created_by: u.id
  };

  db.run(
    `INSERT INTO registros
    (salon_id, fecha, paquete, talon, extra, comision, gasto, sueldo1, sueldo2, sueldo3, sueldo4, total_ingresos, total_egresos, utilidad, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.salon_id, data.fecha, data.paquete, data.talon, data.extra,
      data.comision, data.gasto, data.sueldo1, data.sueldo2, data.sueldo3, data.sueldo4,
      data.total_ingresos, data.total_egresos, data.utilidad, data.created_by
    ],
    function (err) {
      if (err) {
        console.error("Error al guardar el registro:", err.message); // Consola para más detalles
        return res.status(500).json({ error: "Error al guardar el registro en la base de datos", details: err.message });
      }
      res.json({ id: this.lastID, ...data });
    }
  );
});
// Eliminar registro (solo admin)
app.delete("/api/registros/:id", requireRole("admin"), (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM registros WHERE id = ?", [id], function (err) {
    if (err) {
      console.error("Error al eliminar registro:", err.message);
      return res.status(500).json({ error: "Error al eliminar el registro" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    res.json({ ok: true, deletedId: Number(id) });
  });
});

// Listado con filtros: salon, from, to (solo para admin)
app.get("/api/registros", requireRole("admin"), (req, res) => {
  const { salon_id, from, to } = req.query;
  const where = [];
  const params = [];

  if (salon_id) { where.push("r.salon_id = ?"); params.push(salon_id); }
  if (from) { where.push("r.fecha >= ?"); params.push(from); }
  if (to) { where.push("r.fecha <= ?"); params.push(to); }

  const sql = `
    SELECT 
      r.*,
      s.nombre AS salon,
      u.name AS creado_por_nombre,
      u.email AS creado_por_email
    FROM registros r
    JOIN salones s ON s.id = r.salon_id
    LEFT JOIN users u ON u.id = r.created_by
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY r.fecha DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Error al consultar registros:", err.message);
      return res.status(500).json({ error: "Error al consultar registros" });
    }
    res.json(rows);
  });
});


// Salones
app.get("/api/salones", requireAuth, (req, res) => {
  db.all("SELECT * FROM salones WHERE activo = 1 ORDER BY nombre ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error al consultar salones" });
    res.json(rows);
  });
});

// Crear salón (solo admin)
app.post("/api/salones", requireRole("admin"), (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre es obligatorio" });

  db.run("INSERT INTO salones (nombre) VALUES (?)", [nombre.trim()], function (err) {
    if (err) {
      console.error("Error al agregar salón:", err.message); // Para que veas el error en consola
      return res.status(400).json({ error: "Error al crear el salón (quizá ya exista o los datos son inválidos)" });
    }
    res.json({ id: this.lastID, nombre: nombre.trim() });
  });
});

// Desactivar salón (solo admin)
app.delete("/api/salones/:id", requireRole("admin"), (req, res) => {
  db.run("UPDATE salones SET activo = 0 WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: "Error al desactivar el salón" });
    res.json({ ok: true });
  });
});
// Actualizar salón (solo admin)
app.put("/api/salones/:id", requireRole("admin"), (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre obligatorio" });

  db.run(
    "UPDATE salones SET nombre = ? WHERE id = ?",
    [nombre.trim(), req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Error al actualizar" });
      res.json({ ok: true });
    }
  );
});
app.put("/api/salones/:id/reactivar", requireRole("admin"), (req, res) => {
  db.run(
    "UPDATE salones SET activo = 1 WHERE id = ?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Error al reactivar" });
      res.json({ ok: true });
    }
  );
});
// 🔥 Admin: obtener TODOS los salones (activos e inactivos)
app.get("/api/salones/all", requireRole("admin"), (req, res) => {
  db.all("SELECT * FROM salones ORDER BY nombre ASC", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al consultar salones" });
    }
    res.json(rows);
  });
});
// --- Admin: listar usuarios
app.get("/api/users", requireRole("admin"), (req, res) => {
  db.all(
    "SELECT id, name, email, role FROM users ORDER BY id DESC",
    [],
    (err, rows) => {
      if (err) {
        console.error("Error al listar usuarios:", err.message);
        return res.status(500).json({ error: "Error al listar usuarios" });
      }
      res.json(rows);
    }
  );
});

// --- Admin: actualizar usuario
app.put("/api/users/:id", requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, role, password } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }

  if (!name || !email || !role) {
    return res.status(400).json({ error: "Nombre, email y rol son obligatorios" });
  }

  // Validar rol permitido (ajusta si manejas otros roles)
  const rolesPermitidos = ["admin", "user"];
  if (!rolesPermitidos.includes(role)) {
    return res.status(400).json({ error: "Rol inválido" });
  }

  // Si viene password, también actualizamos contraseña
  try {
    if (password && String(password).trim() !== "") {
      const hash = await bcrypt.hash(String(password), 10);

      db.run(
        "UPDATE users SET name = ?, email = ?, role = ?, password_hash = ? WHERE id = ?",
        [name.trim(), email.trim(), role, hash, id],
        function (err) {
          if (err) {
            console.error("Error al actualizar usuario:", err.message);
            return res.status(400).json({ error: "No se pudo actualizar (email duplicado u otro error)" });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
          }
          res.json({ ok: true });
        }
      );
    } else {
      db.run(
        "UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?",
        [name.trim(), email.trim(), role, id],
        function (err) {
          if (err) {
            console.error("Error al actualizar usuario:", err.message);
            return res.status(400).json({ error: "No se pudo actualizar (email duplicado u otro error)" });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
          }
          res.json({ ok: true });
        }
      );
    }
  } catch (e) {
    console.error("Error hash password:", e.message);
    res.status(500).json({ error: "Error interno al actualizar usuario" });
  }
});

// --- Admin: eliminar usuario
app.delete("/api/users/:id", requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }

  // evitar borrarse a sí mismo (opcional, recomendado)
  if (req.session.user && req.session.user.id === id) {
    return res.status(400).json({ error: "No puedes eliminar tu propio usuario mientras estás logueado" });
  }

  db.run("DELETE FROM users WHERE id = ?", [id], function (err) {
    if (err) {
      console.error("Error al eliminar usuario:", err.message);
      return res.status(500).json({ error: "Error al eliminar usuario" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({ ok: true, deletedId: id });
  });
});

// ==============================
// DASHBOARD (solo admin)
// ==============================

// Resumen general (tarjetas KPI)
app.get("/api/dashboard/resumen", requireRole("admin"), (req, res) => {
  const sql = `
    SELECT
      COUNT(*) AS total_reportes,
      COALESCE(SUM(total_ingresos), 0) AS total_ingresos,
      COALESCE(SUM(total_egresos), 0) AS total_egresos,
      COALESCE(SUM(utilidad), 0) AS total_utilidad
    FROM registros
  `;

  db.get(sql, [], (err, row) => {
    if (err) {
      console.error("Error dashboard/resumen:", err.message);
      return res.status(500).json({ error: "Error al obtener resumen" });
    }

    res.json(
      row || {
        total_reportes: 0,
        total_ingresos: 0,
        total_egresos: 0,
        total_utilidad: 0
      }
    );
  });
});

// Utilidad por salón (gráfica barras)
// NOTA: usamos LEFT JOIN para incluir salones, pero el frontend filtrará los que no tengan reportes.
// Si prefieres, puedes cambiar a INNER JOIN.
app.get("/api/dashboard/utilidad-por-salon", requireRole("admin"), (req, res) => {
  const sql = `
    SELECT
      s.id,
      s.nombre AS salon,
      COALESCE(SUM(r.total_ingresos), 0) AS total_ingresos,
      COALESCE(SUM(r.total_egresos), 0) AS total_egresos,
      COALESCE(SUM(r.utilidad), 0) AS total_utilidad,
      COUNT(r.id) AS total_reportes
    FROM salones s
    LEFT JOIN registros r ON r.salon_id = s.id
    GROUP BY s.id, s.nombre
    ORDER BY total_utilidad DESC, s.nombre ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Error dashboard/utilidad-por-salon:", err.message);
      return res.status(500).json({ error: "Error al obtener utilidad por salón" });
    }

    res.json(rows || []);
  });
});

// Tendencia por fecha (últimos N días)
app.get("/api/dashboard/tendencia", requireRole("admin"), (req, res) => {
  let dias = Number(req.query.dias || 7);

  if (!Number.isInteger(dias) || dias <= 0) dias = 7;
  if (dias > 90) dias = 90;

  const sql = `
    SELECT
      fecha,
      COALESCE(SUM(total_ingresos), 0) AS total_ingresos,
      COALESCE(SUM(total_egresos), 0) AS total_egresos,
      COALESCE(SUM(utilidad), 0) AS total_utilidad,
      COUNT(*) AS total_reportes
    FROM registros
    WHERE fecha >= date('now', ?)
    GROUP BY fecha
    ORDER BY fecha ASC
  `;

  const offset = `-${dias - 1} days`;

  db.all(sql, [offset], (err, rows) => {
    if (err) {
      console.error("Error dashboard/tendencia:", err.message);
      return res.status(500).json({ error: "Error al obtener tendencia" });
    }

    res.json({ dias, rows: rows || [] });
  });
});

app.get("/", (req, res) => {
  res.redirect("/login.html");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor en puerto ${PORT}`));
