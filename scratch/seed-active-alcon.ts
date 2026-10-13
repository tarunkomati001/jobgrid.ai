import { db } from '../src/database/db';

async function main() {
  const jobs = [
    {
      id: "alcon_software_engineer_50218",
      title: "Software Engineer",
      company: "Alcon",
      ats: "WORKDAY",
      url: "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Mulgrave/Software-Engineer_R-2026-50218-1"
    },
    {
      id: "alcon_sales_madurai_49856",
      title: "Sr Associate I - Field Sales",
      company: "Alcon",
      ats: "WORKDAY",
      url: "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Madurai/Sr-Associate-I--Ocular-Health-Pharma-General-Field-Sales---Account-Management_R-2026-49856-1"
    }
  ];

  for (const j of jobs) {
    await db.query(
      `INSERT INTO jobs (id, title, company, ats, url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, title = EXCLUDED.title`,
      [j.id, j.title, j.company, j.ats, j.url]
    );
    console.log(`Saved active job: ${j.title} (${j.url})`);
  }

  await db.close();
}

main().catch(console.error);
