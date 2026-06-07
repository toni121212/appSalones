const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const pool = require("./db");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: "cambia_esto_por_algo_largo",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true }
  })
);

// ==============================
// CREAR TABLAS AUTOMÁTICAMENTE
// ==============================

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS salones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) UNIQUE NOT NULL,
        activo BOOLEAN DEFAULT TRUE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin','user') NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS registros (
        id INT AUTO_INCREMENT PRIMARY KEY,
        salon_id INT NOT NULL,
        fecha DATE NOT NULL,
        paquete DECIMAL(10,2) DEFAULT 0,
        talon DECIMAL(10,2) DEFAULT 0,
        extra DECIMAL(10,2) DEFAULT 0,
        comision DECIMAL(10,2) DEFAULT 0,
        gasto DECIMAL(10,2) DEFAULT 0,
        sueldo1 DECIMAL(10,2) DEFAULT 0,
        sueldo2 DECIMAL(10,2) DEFAULT 0,
        sueldo3 DECIMAL(10,2) DEFAULT 0,
        sueldo4 DECIMAL(10,2) DEFAULT 0,
        total_ingresos DECIMAL(10,2) DEFAULT 0,
        total_egresos DECIMAL(10,2) DEFAULT 0,
        utilidad DECIMAL(10,2) DEFAULT 0,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (salon_id) REFERENCES salones(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    console.log("✅ Tablas verificadas");

  } catch (err) {
    console.error("Error creando tablas:", err.message);
  }
}

// ==============================
// MIDDLEWARES
// ==============================

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

// ==============================
// SEED ADMIN
// ==============================

async function seedAdmin() {
  try {
    const email = "admin@admin.com";
    const pass = "123456";

    const [rows] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (rows.length > 0) return;

    const hash = await bcrypt.hash(pass, 10);

    await pool.query(
      "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
      ["Administrador", email, hash, "admin"]
    );

    console.log("✅ Admin creado");

  } catch (err) {
    console.error("Error seedAdmin:", err.message);
  }
}

// ==============================
// AUTH
// ==============================

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0)
      return res.status(401).json({ error: "Credenciales inválidas" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok)
      return res.status(401).json({ error: "Credenciales inválidas" });

    req.session.user = { id: user.id, name: user.name, role: user.role };

    res.json({ message: "OK", user: req.session.user });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en login" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ message: "Logout" }));
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

// ==============================
// CALCULOS
// ==============================

function calcTotals(body) {
  const n = (x) => Number(x || 0);

  const total_ingresos =
    n(body.paquete) + n(body.talon) + n(body.extra);

  const total_egresos =
    n(body.comision) +
    n(body.gasto) +
    n(body.sueldo1) +
    n(body.sueldo2) +
    n(body.sueldo3) +
    n(body.sueldo4);

  return {
    total_ingresos,
    total_egresos,
    utilidad: total_ingresos - total_egresos
  };
}

// ==============================
// REGISTROS
// ==============================

app.post("/api/registros", requireAuth, async (req, res) => {
  const { salon_id, fecha } = req.body;

  if (!salon_id || !fecha)
    return res.status(400).json({ error: "Salón y fecha obligatorios" });

  const t = calcTotals(req.body);
  const u = req.session.user;

  try {
    const [result] = await pool.query(
      `INSERT INTO registros
      (salon_id, fecha,cliente_nombre,cliente_numero, paquete, talon, extra, comision, gasto,
       sueldo1, sueldo2, sueldo3, sueldo4,
       total_ingresos, total_egresos, utilidad, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        salon_id,
        fecha,
        req.body.cliente_nombre,
        req.body.cliente_numero,
        req.body.paquete || 0,
        req.body.talon || 0,
        req.body.extra || 0,
        req.body.comision || 0,
        req.body.gasto || 0,
        req.body.sueldo1 || 0,
        req.body.sueldo2 || 0,
        req.body.sueldo3 || 0,
        req.body.sueldo4 || 0,
        t.total_ingresos,
        t.total_egresos,
        t.utilidad,
        u.id
      ]
    );

    res.json({ id: result.insertId });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar registro" });
  }
});

// ==============================
// INICIALIZAR SERVIDOR
// ==============================

async function startServer() {
  await initDatabase();
  await seedAdmin();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
}
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// ==============================
// SALONES
// ==============================

app.get("/api/salones", requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM salones WHERE activo = 1 ORDER BY nombre ASC"
  );
  res.json(rows);
});

app.get("/api/salones/all", requireRole("admin"), async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM salones ORDER BY nombre ASC"
  );
  res.json(rows);
});

app.post("/api/salones", requireRole("admin"), async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre obligatorio" });

  try {
    await pool.query("INSERT INTO salones (nombre) VALUES (?)", [nombre]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: "El salón ya existe" });
  }
});

app.put("/api/salones/:id", requireRole("admin"), async (req, res) => {
  await pool.query(
    "UPDATE salones SET nombre = ? WHERE id = ?",
    [req.body.nombre, req.params.id]
  );
  res.json({ ok: true });
});

app.delete("/api/salones/:id", requireRole("admin"), async (req, res) => {
  await pool.query(
    "UPDATE salones SET activo = 0 WHERE id = ?",
    [req.params.id]
  );
  res.json({ ok: true });
});

app.put("/api/salones/:id/reactivar", requireRole("admin"), async (req, res) => {
  await pool.query(
    "UPDATE salones SET activo = 1 WHERE id = ?",
    [req.params.id]
  );
  res.json({ ok: true });
});
// ==============================
// USERS
// ==============================

app.get("/api/users", requireRole("admin"), async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id,name,email,role FROM users ORDER BY id DESC"
  );
  res.json(rows);
});

app.post("/api/users", requireRole("admin"), async (req, res) => {
  const { name, email, password, role } = req.body;

  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
    [name, email, hash, role]
  );

  res.json({ ok: true });
});

app.put("/api/users/:id", requireRole("admin"), async (req, res) => {
  const { name, email, role, password } = req.body;

  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "UPDATE users SET name=?,email=?,role=?,password_hash=? WHERE id=?",
      [name, email, role, hash, req.params.id]
    );
  } else {
    await pool.query(
      "UPDATE users SET name=?,email=?,role=? WHERE id=?",
      [name, email, role, req.params.id]
    );
  }

  res.json({ ok: true });
});

app.delete("/api/users/:id", requireRole("admin"), async (req, res) => {
  await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});
// ==============================
// DASHBOARD
// ==============================

app.get("/api/dashboard/resumen", requireRole("admin"), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS total_reportes,
      COALESCE(SUM(total_ingresos),0) AS total_ingresos,
      COALESCE(SUM(total_egresos),0) AS total_egresos,
      COALESCE(SUM(utilidad),0) AS total_utilidad
    FROM registros
  `);

  res.json(rows[0]);
});

app.get("/api/dashboard/utilidad-por-salon", requireRole("admin"), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT s.nombre AS salon,
           COUNT(r.id) AS total_reportes,
           COALESCE(SUM(r.utilidad),0) AS total_utilidad
    FROM salones s
    LEFT JOIN registros r ON r.salon_id = s.id
    GROUP BY s.id
    ORDER BY total_utilidad DESC
  `);
  res.json(rows);
});

app.get("/api/dashboard/tendencia", requireRole("admin"), async (req, res) => {
  const dias = Number(req.query.dias || 7);

  const [rows] = await pool.query(`
    SELECT fecha,
           SUM(total_ingresos) AS total_ingresos,
           SUM(total_egresos) AS total_egresos,
           SUM(utilidad) AS total_utilidad
    FROM registros
    WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY fecha
    ORDER BY fecha ASC
  `, [dias]);

  res.json({ rows });
});
// ==============================
// LISTAR REGISTROS (REPORTES)
// ==============================

app.get("/api/registros", requireAuth, async (req, res) => {

  try {
    let sql = `
      SELECT r.*, 
             s.nombre AS salon,
             u.name AS creado_por_nombre
      FROM registros r
      JOIN salones s ON r.salon_id = s.id
      LEFT JOIN users u ON r.created_by = u.id
      WHERE 1=1
    `;

    const params = [];

    // Filtro por salón
    if (req.query.salon_id) {
      sql += " AND r.salon_id = ?";
      params.push(req.query.salon_id);
    }
    // Filtro por encargado
if (req.query.encargado_id) {
  sql += " AND r.created_by = ?";
  params.push(req.query.encargado_id);
}

    // Filtro fecha desde
    if (req.query.from) {
      sql += " AND r.fecha >= ?";
      params.push(req.query.from);
    }

    // Filtro fecha hasta
    if (req.query.to) {
      sql += " AND r.fecha <= ?";
      params.push(req.query.to);
    }

    // Si NO es admin → solo sus registros
    if (req.session.user.role !== "admin") {
      sql += " AND r.created_by = ?";
      params.push(req.session.user.id);
    }

    sql += " ORDER BY r.fecha DESC";

    const [rows] = await pool.query(sql, params);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener registros" });
  }
});
// ==============================
// ELIMINAR REGISTRO
// ==============================

app.delete("/api/registros/:id", requireAuth, async (req, res) => {

  try {

    const id = req.params.id;

    // Si no es admin → solo puede borrar sus propios registros
    if (req.session.user.role !== "admin") {

      const [rows] = await pool.query(
        "SELECT created_by FROM registros WHERE id = ?",
        [id]
      );

      if (rows.length === 0)
        return res.status(404).json({ error: "Registro no encontrado" });

      if (rows[0].created_by !== req.session.user.id)
        return res.status(403).json({ error: "Sin permisos" });
    }

    await pool.query(
      "DELETE FROM registros WHERE id = ?",
      [id]
    );

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar registro" });
  }

});
startServer();