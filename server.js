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

    const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);

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
seedAdmin();

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

  const utilidad = total_ingresos - total_egresos;

  return { total_ingresos, total_egresos, utilidad };
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
      (salon_id, fecha, paquete, talon, extra, comision, gasto,
       sueldo1, sueldo2, sueldo3, sueldo4,
       total_ingresos, total_egresos, utilidad, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        salon_id,
        fecha,
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

app.get("/api/registros", requireRole("admin"), async (req, res) => {
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
      u.name AS creado_por_nombre
    FROM registros r
    JOIN salones s ON s.id = r.salon_id
    LEFT JOIN users u ON u.id = r.created_by
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY r.fecha DESC
  `;

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar registros" });
  }
});

app.delete("/api/registros/:id", requireRole("admin"), async (req, res) => {
  try {
    await pool.query("DELETE FROM registros WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar" });
  }
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

// ==============================
// DASHBOARD
// ==============================

app.get("/api/dashboard/resumen", requireRole("admin"), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS total_reportes,
      COALESCE(SUM(total_ingresos), 0) AS total_ingresos,
      COALESCE(SUM(total_egresos), 0) AS total_egresos,
      COALESCE(SUM(utilidad), 0) AS total_utilidad
    FROM registros
  `);

  res.json(rows[0]);
});

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));