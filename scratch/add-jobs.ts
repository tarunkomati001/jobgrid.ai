import { db } from "../src/database/db";

async function main() {
  console.log("Adding ServiceNow 2 and Socotec to jobs table...");

  // Clean up any stale screening redirect urls
  await db.query("DELETE FROM jobs WHERE url LIKE '%screening%'");

  const jobsToInsert = [
    {
      id: "wd_clario_clinical_r18142",
      title: "Medical Imaging Technologist I",
      company: "Clario Clinical",
      ats: "WORKDAY",
      url: "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1"
    },
    {
      id: "wd_alcon_careers_49499",
      title: "Délégué.e Commercial (Départements 22, 29 et 35)",
      company: "Alcon",
      ats: "WORKDAY",
      url: "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Dlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1?codes=IND"
    }
  ];

  for (const j of jobsToInsert) {
    await db.query(
      `INSERT INTO jobs (id, title, company, ats, url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET url = $5, ats = $4`,
      [j.id, j.title, j.company, j.ats, j.url]
    );
    console.log(`✅ Added/Updated job: ${j.company} - ${j.url}`);
  }

  const res = await db.query(
    "SELECT id, company, ats, url FROM jobs WHERE ats IN ('SMARTRECRUITERS', 'LEVER', 'WORKDAY') ORDER BY ats DESC, id ASC"
  );
  console.log("\n📋 Active SMARTRECRUITERS & LEVER jobs in DB:");
  console.table(res.rows);

  await db.close();
}

main().catch(console.error);
