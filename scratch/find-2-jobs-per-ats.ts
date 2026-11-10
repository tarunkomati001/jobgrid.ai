import { db } from "../src/database/db";

async function main() {
  const res = await db.query(`
    SELECT ats, count(*), array_agg(url) as urls
    FROM jobs
    GROUP BY ats
    ORDER BY ats
  `);

  console.log("=== JOBS PER ATS IN DATABASE ===");
  for (const row of res.rows) {
    console.log(`\nATS: ${row.ats} (Count: ${row.count})`);
    const sampleUrls = (row.urls || []).slice(0, 3);
    for (const u of sampleUrls) {
      console.log(`  - ${u}`);
    }
  }

  await db.pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

