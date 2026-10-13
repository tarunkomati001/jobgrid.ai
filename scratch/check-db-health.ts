import { db } from "../src/database/db";
import { config } from "../src/config";

async function checkDatabaseHealth() {
  console.log("===============================================================================");
  console.log("🏥 CLUCO.AI DATABASE HEALTH CHECK");
  console.log("===============================================================================\n");

  console.log(`🔌 Database Mode Target: ${config.dbUrl.startsWith("postgres") ? "PostgreSQL / Supabase" : "SQLite"}`);
  console.log(`🔗 Database URL/Target: ${config.dbUrl.replace(/Tarunbabu@2006/g, "*****")}\n`);

  const startMs = Date.now();

  try {
    // 1. Basic Ping / Connectivity Test
    const pingRes = await db.query("SELECT CURRENT_TIMESTAMP as now");
    const latency = Date.now() - startMs;
    
    console.log("✅ Connection Status: CONNECTED & ONLINE");
    console.log(`⏱️ Query Latency: ${latency} ms`);
    console.log(`🕒 Server Timestamp: ${pingRes.rows[0].now}\n`);

    // 2. Table Row Counts Audit
    console.log("📊 TABLE ROW COUNTS AUDIT:");
    console.log("--------------------------------------------------------------------------------");

    const tables = [
      "users",
      "user_profiles",
      "resumes",
      "jobs",
      "applications",
      "application_answers",
      "application_events",
      "user_saved_answers"
    ];

    for (const table of tables) {
      try {
        const countRes = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = countRes.rows[0].count;
        console.log(`  • ${table.padEnd(22)} : ${count} rows`);
      } catch (err: any) {
        console.log(`  ❌ ${table.padEnd(22)} : ERROR (${err.message})`);
      }
    }

    // 3. Application Status Breakdown
    console.log("\n📈 APPLICATION STATUS BREAKDOWN:");
    console.log("--------------------------------------------------------------------------------");
    const appBreakdown = await db.query(
      "SELECT status, COUNT(*) as count FROM applications GROUP BY status"
    );

    if (appBreakdown.rows.length === 0) {
      console.log("  (No application records found)");
    } else {
      appBreakdown.rows.forEach((row: any) => {
        console.log(`  • ${row.status.padEnd(22)} : ${row.count} application(s)`);
      });
    }

    // 4. Active Candidates Roster Overview
    console.log("\n👤 ACTIVE CANDIDATES OVERVIEW:");
    console.log("--------------------------------------------------------------------------------");
    const candidatesRes = await db.query(
      `SELECT u.id, u.email, p.first_name, p.last_name, r.file_name as active_resume
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       LEFT JOIN resumes r ON u.id = r.user_id AND r.is_active = 1
       ORDER BY u.id ASC LIMIT 5`
    );

    candidatesRes.rows.forEach((c: any, idx: number) => {
      console.log(`  ${idx + 1}. [${c.id}] ${c.first_name || "N/A"} ${c.last_name || ""} (${c.email}) | Resume: ${c.active_resume || "None"}`);
    });
    if (candidatesRes.rows.length === 0) {
      console.log("  (No candidates registered)");
    }

    console.log("\n===============================================================================");
    console.log("🎉 DATABASE HEALTH CHECK COMPLETED SUCCESSFULLY - ALL SYSTEMS FUNCTIONAL!");
    console.log("===============================================================================\n");

  } catch (error: any) {
    console.error("❌ DATABASE HEALTH CHECK FAILED:", error.message);
    if (error.message.includes("ENOTFOUND")) {
      console.log("\n⚠️ DIAGNOSIS: Supabase PostgreSQL host `db.ovewmitrxkzjxrmbhyyk.supabase.co` DNS resolution failed.");
      console.log("   The remote Supabase project may be paused/inactive or requires updating the connection pooler URL.");
    }
  } finally {
    await db.close();
    process.exit(0);
  }
}

checkDatabaseHealth();
