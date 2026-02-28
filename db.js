const mysql = require("mysql2/promise");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL no definida");
  process.exit(1);
}

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;