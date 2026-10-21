import { db } from "../src/database/db";

async function main() {
  // 1. Delete Verity Cloud duplicate (job page without /application)
  const del1 = await db.query("DELETE FROM jobs WHERE id = '2f706913-2486-4cca-b775-a8836f1067ef'");
  console.log(`🗑️  Deleted Verity Cloud duplicate (job page): ${del1.rowCount} row(s)`);

  // 2. Re-add Notion job (wrongly deleted)
  const existingNotion = await db.query("SELECT id FROM jobs WHERE url = 'https://jobs.ashbyhq.com/notion/05e14247-17c4-4e98-9a13-53828a4e2f13/application'");
  if (existingNotion.rowCount === 0) {
    await db.query(
      `INSERT INTO jobs (id, url, company, title, description, ats, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['c03acd96-4685-4e0c-bf9b-39eeab4b51f3', 'https://jobs.ashbyhq.com/notion/05e14247-17c4-4e98-9a13-53828a4e2f13/application', 'Notion', 'Business Development Representative, New York', 'Business Development Representative, New York at Notion', 'ASHBY', 'PENDING']
    );
    console.log("✅ Re-added Notion job");
  } else {
    console.log("ℹ️  Notion job already exists, skipping");
  }

  // 3. Re-add Vanta job (wrongly deleted)
  const existingVanta = await db.query("SELECT id FROM jobs WHERE url = 'https://jobs.ashbyhq.com/vanta/fe5fd1a4-12ff-4703-bed5-6c2f34ba7768/application'");
  if (existingVanta.rowCount === 0) {
    await db.query(
      `INSERT INTO jobs (id, url, company, title, description, ats, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['7007feff-1415-4191-a1d5-50d1fe89e832', 'https://jobs.ashbyhq.com/vanta/fe5fd1a4-12ff-4703-bed5-6c2f34ba7768/application', 'Vanta', 'Senior Account Executive, Growth Stage', 'Senior Account Executive, Growth Stage at Vanta', 'ASHBY', 'PENDING']
    );
    console.log("✅ Re-added Vanta job");
  } else {
    console.log("ℹ️  Vanta job already exists, skipping");
  }

  // 4. Fix the job with wrong title (Enterprise Customer Success Manager)
  await db.query(
    `UPDATE jobs SET company = $1, title = $2, description = $3 WHERE id = $4`,
    ['Ashby', 'Enterprise Customer Success Manager, APAC (Remote)', 'Enterprise Customer Success Manager, APAC (Remote) at Ashby', '9c4b577f-9944-4ffa-a8c9-6027895f4f58']
  );
  console.log("✅ Fixed title for Enterprise Customer Success Manager job");

  const remaining = await db.query("SELECT COUNT(*) as count FROM jobs");
  console.log(`\n✅ Final job count: ${remaining.rows[0].count}`);

  const jobs = await db.query("SELECT id, title, url FROM jobs ORDER BY created_at ASC");
  jobs.rows.forEach((j, i) => {
    console.log(`${i+1}. ${j.title}`);
    console.log(`   ${j.url}`);
  });

  await db.close();
}

main().catch(async (err) => {
  console.error("❌ Error:", err);
  await db.close();
});
