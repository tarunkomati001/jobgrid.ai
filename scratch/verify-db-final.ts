import { db } from "../src/database/db";

async function main() {
  const res = await db.query(`
    SELECT 
      j.url, 
      j.title, 
      j.company, 
      j.ats, 
      a.user_id, 
      a.status, 
      a.screenshot_path 
    FROM applications a 
    JOIN jobs j ON a.job_id = j.id 
    WHERE j.url LIKE '%4720%' OR j.url LIKE '%4812%' OR j.url LIKE '%4679%'
    ORDER BY j.url, a.user_id
  `);

  console.log("Database records for the 3 requested jobs:");
  console.table(res.rows);

  await db.close();
}

main().catch(console.error);
