import { db } from "./db";
import fs from "fs";
import path from "path";

async function setupDatabaseStructure() {
  console.log("===============================================================================");
  console.log("🛠️ CLUCO.AI DATABASE SCHEMA CREATION");
  console.log("===============================================================================\n");

  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    console.log("📜 Executing DDL Statements for 8 core tables...");
    
    // Execute DDL setup
    await db.exec(schemaSql);

    console.log("✅ DDL Execution finished successfully!\n");

    // Verify all 8 tables in database
    const tablesToVerify = [
      "users",
      "user_profiles",
      "resumes",
      "jobs",
      "applications",
      "application_answers",
      "application_events",
      "user_saved_answers"
    ];

    console.log("🔍 VERIFYING CREATED TABLE STRUCTURES:");
    console.log("--------------------------------------------------------------------------------");

    for (const table of tablesToVerify) {
      const res = await db.query(`SELECT COUNT(*) as count FROM public.${table}`);
      console.log(`  ✅ Table 'public.${table.padEnd(20)}' is online & valid (${res.rows[0].count} rows).`);
    }

    console.log("\n===============================================================================");
    console.log("🎉 DATABASE STRUCTURE CREATED SUCCESSFULLY AND READY FOR CANDIDATE DATA!");
    console.log("===============================================================================\n");

  } catch (error: any) {
    console.error("❌ Schema Creation Failed:", error.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

setupDatabaseStructure();
