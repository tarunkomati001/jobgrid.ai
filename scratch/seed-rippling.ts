import { db } from "../src/database/db";
import { v4 as uuidv4 } from "uuid";

async function seedRipplingJobs() {
  const candidateUserId = "usr_hrutin_nammi";

  const jobsToSeed = [
    {
      url: "https://ats.rippling.com/en-GB/rippling/jobs/f255bf03-9173-4c0a-8a18-7cc43c27ded8",
      title: "Data Science Intern - Summer 2027",
      company: "Rippling",
      ats: "RIPPLING",
      description: "Data Science Internship at Rippling."
    },
    {
      url: "https://ats.rippling.com/en-GB/rippling/jobs/8ef65aa0-ede3-45cb-814f-3631c25597cf",
      title: "Demo Site Manager",
      company: "Rippling",
      ats: "RIPPLING",
      description: "Demo Site Manager at Rippling."
    },
    {
      url: "https://ats.rippling.com/en-GB/rippling/jobs/98b559a6-c8b2-4ede-85d9-cbf4883da996",
      title: "Director of Engineering, HRIS Core Flows",
      company: "Rippling",
      ats: "RIPPLING",
      description: "Director of Engineering, HRIS Core Flows at Rippling."
    },
    {
      url: "https://ats.rippling.com/en-GB/rippling/jobs/6a055998-1560-4e2b-b0eb-79913c5d49f1",
      title: "Director of Verticals Marketing",
      company: "Rippling",
      ats: "RIPPLING",
      description: "Director of Verticals Marketing at Rippling."
    }
  ];

  console.log("🌱 Seeding Rippling Jobs and Applications into PostgreSQL...");

  for (const job of jobsToSeed) {
    let jobId: string;
    const existing = await db.query("SELECT id FROM jobs WHERE url = $1", [job.url]);
    if (existing.rowCount > 0) {
      jobId = existing.rows[0].id;
      await db.query(
        "UPDATE jobs SET title = $1, company = $2, ats = $3 WHERE id = $4",
        [job.title, job.company, job.ats, jobId]
      );
      console.log(`Updated job ${job.title} (${jobId})`);
    } else {
      jobId = uuidv4();
      await db.query(
        `INSERT INTO jobs (id, url, company, title, description, ats, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'EXTRACTED')`,
        [jobId, job.url, job.company, job.title, job.description, job.ats]
      );
      console.log(`Inserted job ${job.title} (${jobId})`);
    }

    const appCheck = await db.query(
      "SELECT id FROM applications WHERE user_id = $1 AND job_id = $2",
      [candidateUserId, jobId]
    );

    if (appCheck.rowCount === 0) {
      await db.query(
        `INSERT INTO applications (id, user_id, job_id, resume_id, ats, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
        [uuidv4(), candidateUserId, jobId, "res_usr_hrutin_nammi", job.ats]
      );
      console.log(`Registered pending application for ${job.title}`);
    }
  }

  console.log("✅ Seeding complete!");
  await db.close();
}

seedRipplingJobs().catch(console.error);
