import { db } from '../src/database/db';

async function main() {
  await db.query(`
    DELETE FROM jobs WHERE id = 'wd_alcon_careers_49499' OR url LIKE '%49499%'
  `);
  console.log("Deleted expired Alcon job from database.");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
