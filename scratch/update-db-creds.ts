import { db } from "../src/database/db";

async function main() {
  await db.query(`
    INSERT INTO public.ats_credentials (domain, email, password, updated_at)
    VALUES ('accenture.wd103.myworkdayjobs.com', 'babufakemail@gmail.com', 'Tarun@143', NOW())
    ON CONFLICT (domain, email) DO UPDATE SET password = 'Tarun@143', updated_at = NOW()
  `);
  console.log("Accenture upserted!");
  await db.close();
}

main().catch(console.error);
