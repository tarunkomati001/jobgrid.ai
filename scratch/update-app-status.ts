import { db } from "../src/database/db";
import path from "path";

async function main() {
  const updates = [
    {
      url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4720",
      screenshot: path.resolve(__dirname, "taleo_job_4720_tab_1_verified.png"),
      rid: "4720"
    },
    {
      url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4812",
      screenshot: path.resolve(__dirname, "taleo_job_4812_tab_2_verified.png"),
      rid: "4812"
    },
    {
      url: "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4679",
      screenshot: path.resolve(__dirname, "taleo_job_4679_tab_3_verified.png"),
      rid: "4679"
    }
  ];

  for (const item of updates) {
    const res = await db.query(
      `UPDATE applications 
       SET status = 'MANUAL_REVIEW', screenshot_path = $1, updated_at = NOW()
       WHERE user_id = 'usr_hrutin_nammi' AND job_id IN (SELECT id FROM jobs WHERE url = $2)
       RETURNING id, status, screenshot_path`,
      [item.screenshot, item.url]
    );
    console.log(`Updated RID ${item.rid}:`, res.rows);
  }

  const finalCheck = await db.query(`
    SELECT j.title, j.company, j.ats, j.url, a.user_id, a.status, a.screenshot_path
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    WHERE j.url LIKE '%4720%' OR j.url LIKE '%4812%' OR j.url LIKE '%4679%'
    ORDER BY j.url, a.user_id
  `);

  console.log("\nFinal verification of jobs & applications in database:");
  console.table(finalCheck.rows);

  await db.close();
}

main().catch(console.error);
