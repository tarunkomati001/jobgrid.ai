import { db } from "../src/database/db";

async function main() {
  console.log("🔍 Fetching all jobs...");
  const allJobs = await db.query("SELECT id, url, title, company, status, created_at FROM jobs ORDER BY created_at ASC");
  console.log(`Found ${allJobs.rowCount} jobs total.\n`);

  // Extract ashby_jid from a URL
  function extractJid(url: string): string | null {
    try {
      const u = new URL(url);
      return u.searchParams.get("ashby_jid") || u.pathname.split("/").filter(Boolean).pop() || null;
    } catch {
      return null;
    }
  }

  // Group jobs by their ashby_jid
  const jidMap = new Map<string, typeof allJobs.rows>();
  const noJidJobs: typeof allJobs.rows = [];

  for (const job of allJobs.rows) {
    const jid = extractJid(job.url);
    if (!jid) {
      noJidJobs.push(job);
      continue;
    }
    if (!jidMap.has(jid)) jidMap.set(jid, []);
    jidMap.get(jid)!.push(job);
  }

  const idsToDelete: string[] = [];

  for (const [jid, jobs] of jidMap.entries()) {
    if (jobs.length <= 1) continue;

    console.log(`\n🔁 Duplicate group for jid=${jid} (${jobs.length} entries):`);
    for (const j of jobs) {
      console.log(`   [${j.id.slice(0,8)}] ${j.title} | ${j.url}`);
    }

    // Keep preference: prefer jobs with real titles over "Position X" or "Unknown Position"
    // Also prefer newer records (higher created_at) if both have real titles
    const sorted = [...jobs].sort((a, b) => {
      const aIsPlaceholder = /^(position \d+|unknown position|join a team)/i.test(a.title);
      const bIsPlaceholder = /^(position \d+|unknown position|join a team)/i.test(b.title);

      if (aIsPlaceholder && !bIsPlaceholder) return 1;  // b is better
      if (!aIsPlaceholder && bIsPlaceholder) return -1; // a is better

      // Both real or both placeholders: prefer newer
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const keep = sorted[0];
    const toDelete = sorted.slice(1);

    console.log(`   ✅ Keeping: [${keep.id.slice(0,8)}] ${keep.title}`);
    for (const d of toDelete) {
      console.log(`   🗑️  Deleting: [${d.id.slice(0,8)}] ${d.title}`);
      idsToDelete.push(d.id);
    }
  }

  // Also detect exact URL duplicates across the no-jid group
  const urlSeen = new Set<string>();
  for (const job of noJidJobs) {
    if (urlSeen.has(job.url)) {
      console.log(`\n🔁 Exact URL duplicate (no jid): [${job.id.slice(0,8)}] ${job.url}`);
      idsToDelete.push(job.id);
    } else {
      urlSeen.add(job.url);
    }
  }

  if (idsToDelete.length === 0) {
    console.log("\n✅ No duplicates found. Database is clean!");
    await db.close();
    return;
  }

  console.log(`\n🧹 Deleting ${idsToDelete.length} duplicate job(s) and their orphaned application records...`);

  for (const id of idsToDelete) {
    // Delete orphaned applications first
    const delApps = await db.query("DELETE FROM applications WHERE job_id = $1", [id]);
    console.log(`   🗑️  Deleted ${delApps.rowCount} application(s) for job ${id.slice(0,8)}`);

    // Then delete the job
    await db.query("DELETE FROM jobs WHERE id = $1", [id]);
    console.log(`   🗑️  Deleted job ${id.slice(0,8)}`);
  }

  const remaining = await db.query("SELECT COUNT(*) as count FROM jobs");
  const remainingApps = await db.query("SELECT COUNT(*) as count FROM applications");
  console.log(`\n✅ Done! ${remaining.rows[0].count} job(s) and ${remainingApps.rows[0].count} application(s) remain in the database.`);

  await db.close();
}

main().catch(async (err) => {
  console.error("❌ Error:", err);
  await db.close();
});
