import { db } from "../src/database/db";
import { v4 as uuidv4 } from "uuid";

interface BambooJob {
  url: string;
  company: string;
  title: string;
  description: string;
}

const jobs: BambooJob[] = [
  {
    url: "https://atlas.bamboohr.com/careers/633",
    company: "Atlas Systems",
    title: "Senior Java Developer",
    description: "Senior Java Developer at Atlas Systems Inc. specializing in Spring Boot, REST APIs, Microservices, and cloud deployments."
  },
  {
    url: "https://atlas.bamboohr.com/careers/604",
    company: "Atlas Systems",
    title: "Senior Full Stack Developer – AI-Native Engineering",
    description: "Senior Full Stack Developer with AI-Native Engineering experience building modern scalable full stack architectures."
  },
  {
    url: "https://headspin.bamboohr.com/careers/331",
    company: "HeadSpin",
    title: "Senior Microsoft Windows SQL Server DBA",
    description: "Senior DBA managing high availability Microsoft Windows SQL Server database infrastructure."
  },
  {
    url: "https://prentkeromich.bamboohr.com/careers/506",
    company: "PRC-Saltillo",
    title: "Maintenance / Facilities Specialist",
    description: "Maintenance and facilities specialist responsible for building systems, repairs, and facility maintenance."
  },
  {
    url: "https://prentkeromich.bamboohr.com/careers/526",
    company: "PRC-Saltillo",
    title: "AAC Consultant",
    description: "Customer Sales and Solutions AAC Consultant empowering communication and providing assistive tech support."
  },
  {
    url: "https://greenparkcontent.bamboohr.com/careers/831",
    company: "Greenpark",
    title: "Graphic Designer",
    description: "Creative digital agency Graphic Designer for omnichannel search, social content, and visual design."
  },
  {
    url: "https://prentkeromich.bamboohr.com/careers/527",
    company: "PRC-Saltillo",
    title: "Mechanical/Hardware Engineering Manager",
    description: "Engineering leadership and technical management of hardware and mechanical product development teams."
  }
];

async function main() {
  console.log("Seeding 7 BambooHR jobs into database...");
  for (const j of jobs) {
    const existing = await db.query("SELECT id FROM jobs WHERE url = $1", [j.url]);
    if (existing.rowCount === 0) {
      const jobId = uuidv4();
      await db.query(
        `INSERT INTO jobs (id, url, company, title, description, ats, status)
         VALUES ($1, $2, $3, $4, $5, 'BAMBOOHR', 'EXTRACTED')`,
        [jobId, j.url, j.company, j.title, j.description]
      );
      console.log(`✅ Inserted ${j.title} at ${j.company} (${j.url})`);
    } else {
      await db.query(
        `UPDATE jobs SET company = $1, title = $2, description = $3, ats = 'BAMBOOHR' WHERE url = $4`,
        [j.company, j.title, j.description, j.url]
      );
      console.log(`🔄 Updated ${j.title} at ${j.company} (${j.url})`);
    }
  }
  console.log("Seeding completed successfully!");
  await db.close();
}

main().catch(console.error);

