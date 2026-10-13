import { db } from '../src/database/db';

async function main() {
  // Check constraints
  const constraints = await db.query(`
    SELECT conname, contype 
    FROM pg_constraint 
    WHERE conrelid = 'public.ats_credentials'::regclass;
  `);
  console.log("Current constraints:", constraints.rows);

  // Update Alcon password directly to Tarun@143
  await db.query(`
    UPDATE public.ats_credentials 
    SET password = 'Tarun@143', account_status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
    WHERE domain = 'alcon.wd5.myworkdayjobs.com';
  `);

  // Ensure unique constraint exists
  try {
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ats_credentials_domain_email_idx 
      ON public.ats_credentials (domain, email);
    `);
    console.log("Unique index ensured on (domain, email).");
  } catch (e: any) {
    console.warn("Index error:", e.message);
  }

  // Check rows for Workday
  const rows = await db.query(`
    SELECT id, domain, email, password, account_status 
    FROM public.ats_credentials 
    WHERE domain LIKE '%myworkdayjobs.com%';
  `);
  console.log("Updated Workday credentials in DB:", rows.rows);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
