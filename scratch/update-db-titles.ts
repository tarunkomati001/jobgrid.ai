import { db } from "../src/database/db";

async function main() {
  const updates = [
    {
      url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4720",
      title: "Information Systems Security Officer",
      company: "Base-2 Solutions"
    },
    {
      url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4812",
      title: "OSINT Platform User Support Specialist 4",
      company: "Base-2 Solutions"
    },
    {
      url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4679",
      title: "Senior Information System Security Officer",
      company: "Base-2 Solutions"
    }
  ];

  for (const item of updates) {
    const res = await db.query(
      "UPDATE jobs SET title = $1, company = $2 WHERE url = $3 RETURNING id, title, company",
      [item.title, item.company, item.url]
    );
    console.log("Updated job:", res.rows);
  }

  const jobs = await db.query("SELECT id, url, title, company, ats, status FROM jobs WHERE url LIKE '%taleo%'");
  console.log("\nCurrent Taleo jobs in DB:");
  console.log(jobs.rows);

  await db.close();
}

main().catch(console.error);
