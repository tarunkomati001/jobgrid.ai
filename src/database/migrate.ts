import fs from "fs";
import path from "path";
import { db } from "./db";

async function migrate() {
  console.log("🚀 Starting database migrations...");
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    // Execute the full schema.sql file content
    await db.exec(schemaSql);

    // Dynamic schema patch to add screenshot_path if it doesn't exist
    try {
      await db.query("ALTER TABLE applications ADD COLUMN screenshot_path TEXT");
      console.log("ℹ️ Added screenshot_path column to applications table.");
    } catch (err: any) {
      if (err.message.includes("duplicate column") || err.message.includes("already exists")) {
        console.log("ℹ️ screenshot_path column already exists in applications table.");
      } else {
        console.warn("⚠️ Warning when adding screenshot_path column:", err.message);
      }
    }

    console.log("✅ Database schema migrated successfully!");
  } catch (error) {
    console.error("❌ Database migration failed:", error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

migrate();
