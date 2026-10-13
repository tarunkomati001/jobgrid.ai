import { db } from "../src/database/db";

async function main() {
  const res = await db.query(`
    SELECT 
      j.company, 
      j.title, 
      j.ats, 
      a.status, 
      a.id as application_id, 
      a.screenshot_path, 
      a.updated_at 
    FROM jobs j 
    JOIN applications a ON j.id = a.job_id 
    WHERE j.ats = 'LEVER'
    ORDER BY j.company ASC
  `);
  console.log("\n📊 CURRENT LEVER JOBS IN DATABASE:");
  console.table(res.rows);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
