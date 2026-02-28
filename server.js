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

// ==============================
// INICIALIZAR SERVIDOR
// ==============================

async function startServer() {
  await initDatabase();
  await seedAdmin();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
}

startServer();