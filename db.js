const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./data.db");

db.serialize(() => {
  // Crear la tabla de salones primero
  db.run(`
    CREATE TABLE IF NOT EXISTS salones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL,
      activo INTEGER DEFAULT 1
    )
  `);

  // Crear la tabla de usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','user'))
    )
  `);

  // Crear la tabla de registros
  db.run(`
    CREATE TABLE IF NOT EXISTS registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      paquete REAL DEFAULT 0,
      talon REAL DEFAULT 0,
      extra REAL DEFAULT 0,
      comision REAL DEFAULT 0,
      gasto REAL DEFAULT 0,
      sueldo1 REAL DEFAULT 0,
      sueldo2 REAL DEFAULT 0,
      sueldo3 REAL DEFAULT 0,
      sueldo4 REAL DEFAULT 0,
      total_ingresos REAL DEFAULT 0,
      total_egresos REAL DEFAULT 0,
      utilidad REAL DEFAULT 0,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(created_by) REFERENCES users(id),
      FOREIGN KEY(salon_id) REFERENCES salones(id)
    )
  `);
});

module.exports = db;
