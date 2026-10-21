import { db } from "../src/database/db";

async function testConnection() {
  console.log("Testing database connection...");
  try {
    const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = $1", ["public"]);
    console.log("✅ Successfully connected! Found tables:", res.rows.map((r: any) => r.table_name));
    
    // Also test querying count from users table
    const usersRes = await db.query("SELECT COUNT(*) as count FROM users");
    console.log("✅ Users table query count:", usersRes.rows[0].count);
  } catch (err) {
    console.error("❌ Database query error:", err);
  } finally {
    await db.close();
    process.exit(0);
  }
}

testConnection();
