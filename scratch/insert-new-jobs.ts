import { db } from "../src/database/db";
import { v4 as uuidv4 } from "uuid";

async function main() {
  const newJobs = [
    {
      url: "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND",
      company: "Alcon",
      title: "Ing-Tech-Cial Equipements - Cataracte (Phaco Manager) - 59/60/62/80/95",
      ats: "WORKDAY",
    },
    {
      url: "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Surgical-Account-Manager----New-Zealand_R-2026-49451-1?codes=IND",
      company: "Alcon",
      title: "Surgical Account Manager - New Zealand",
      ats: "WORKDAY",
    },
    {
      url: "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Associate-I--Instrumentation---Calibration-Technical-Support_R-2026-49466-1?codes=IND",
      company: "Alcon",
      title: "Associate I, Instrumentation & Calibration Technical Support",
      ats: "WORKDAY",
    },
  ];

  for (const job of newJobs) {
    const check = await db.query("SELECT id FROM public.jobs WHERE url = $1", [job.url]);
    if (check.rowCount === 0) {
      const id = "job_" + uuidv4().slice(0, 8);
      await db.query(
        "INSERT INTO public.jobs (id, url, company, title, ats, status) VALUES ($1, $2, $3, $4, $5, 'PENDING')",
        [id, job.url, job.company, job.title, job.ats]
      );
      console.log(`✅ Inserted job: ${job.title} (${job.url})`);
    } else {
      console.log(`ℹ️ Job already exists: ${job.title}`);
    }
  }

  const allWd = await db.query("SELECT id, title, company, url, ats FROM public.jobs WHERE ats = 'WORKDAY' OR url LIKE '%myworkdayjobs.com%'");
  console.log("\nCurrent Workday jobs in DB:", allWd.rows);
  await db.close();
}

main().catch(console.error);
