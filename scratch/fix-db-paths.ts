import { db } from "../src/database/db";
import { resolveLocalResumePath } from "../src/utils/path-resolver";

async function main() {
  console.log("Checking database resume paths...");
  
  const r = await db.query("SELECT id, file_path FROM resumes");
  for (const row of r.rows) {
    const fixed = resolveLocalResumePath(row.file_path);
    if (fixed !== row.file_path) {
      await db.query("UPDATE resumes SET file_path = $1 WHERE id = $2", [fixed, row.id]);
      console.log(`✅ Updated resume table ID ${row.id} -> ${fixed}`);
    }
  }

  const p = await db.query("SELECT id, resume_path FROM user_profiles WHERE resume_path IS NOT NULL");
  for (const row of p.rows) {
    const fixed = resolveLocalResumePath(row.resume_path);
    if (fixed !== row.resume_path) {
      await db.query("UPDATE user_profiles SET resume_path = $1 WHERE id = $2", [fixed, row.id]);
      console.log(`✅ Updated user_profiles table ID ${row.id} -> ${fixed}`);
    }
  }

  console.log("Database path check complete.");
  await db.close();
}

main().catch(async err => {
  console.error("Error updating DB paths:", err);
  await db.close();
});
