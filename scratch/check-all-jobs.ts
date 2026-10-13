import { db } from "../src/database/db";

async function checkJobs() {
  const jobsRes = await db.query("SELECT id, url, company, title FROM jobs");
  console.log(`Found ${jobsRes.rows.length} jobs in database:`);
  jobsRes.rows.forEach((job: any, index: number) => {
    console.log(`${index + 1}. [${job.company}] ${job.title} -> ${job.url}`);
  });

  const usersRes = await db.query("SELECT u.id, u.email, p.first_name, p.last_name FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id");
  console.log(`\nFound ${usersRes.rows.length} users in database:`);
  usersRes.rows.forEach((user: any) => {
    console.log(`- ${user.id}: ${user.first_name} ${user.last_name} (${user.email})`);
  });

  await db.close();
}

checkJobs().catch(console.error);
