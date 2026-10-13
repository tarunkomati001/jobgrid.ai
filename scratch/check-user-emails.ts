import { db } from '../src/database/db';

async function main() {
  const users = await db.query('SELECT id, email, created_at FROM public.users');
  console.log('Users:', users.rows);
  const creds = await db.query('SELECT DISTINCT email, password FROM public.ats_credentials');
  console.log('Creds emails:', creds.rows);
  process.exit(0);
}

main().catch(console.error);
