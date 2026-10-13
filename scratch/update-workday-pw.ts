import { db } from "../src/database/db";

async function main() {
  const newPassword = process.env.WORKDAY_PASSWORD || "Tarun@143";
  console.log(`Updating ATS credentials in Postgres to password: ${newPassword}`);
  const res = await db.query(
    "UPDATE public.ats_credentials SET password = $1, updated_at = CURRENT_TIMESTAMP RETURNING domain, email, password, updated_at",
    [newPassword]
  );
  console.log("Updated rows in database:", res.rows);
  await db.close();
}

main().catch(async (e) => {
  console.error("Error updating credentials:", e);
  await db.close();
});
