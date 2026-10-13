import sqlite3 from "sqlite3";
import path from "path";

async function checkSqliteHealth() {
  const dbPath = path.resolve(__dirname, "../job_automation.db");
  console.log("🔌 Checking SQLite Local Database at:", dbPath);

  const db = new sqlite3.Database(dbPath);

  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
      console.error("❌ SQLite Error:", err.message);
      db.close();
      return;
    }

    console.log("✅ Connection Status: ONLINE (SQLite)");
    console.log("📊 Tables Found:", tables.map((t: any) => t.name).join(", "));
    db.close();
  });
}

checkSqliteHealth();
