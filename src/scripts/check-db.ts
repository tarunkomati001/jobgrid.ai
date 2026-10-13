import { db } from "../database/db";

async function main() {
  console.log("Checking users...");
  const users = await db.query("SELECT * FROM users");
  console.log("Users count:", users.rowCount);
  console.log(users.rows);

  console.log("Checking resumes...");
  const resumes = await db.query("SELECT * FROM resumes");
  console.log("Resumes count:", resumes.rowCount);
  console.log(resumes.rows);

  console.log("Checking jobs...");
  const jobs = await db.query("SELECT * FROM jobs");
  console.log("Jobs count:", jobs.rowCount);
  console.log(jobs.rows);

  console.log("Checking user_profiles...");
  const profiles = await db.query("SELECT * FROM user_profiles");
  console.log("Profiles count:", profiles.rowCount);
  console.log(profiles.rows);

  console.log("Checking applications...");
  const applications = await db.query("SELECT * FROM applications");
  console.log("Applications count:", applications.rowCount);
  console.log(applications.rows);

  await db.close();
}

main().catch(console.error);
