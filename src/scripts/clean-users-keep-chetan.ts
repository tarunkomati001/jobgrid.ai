import { db } from "../database/db";

async function cleanUsersKeepChetan() {
  console.log("===============================================================================");
  console.log("🧹 DATABASE USER CLEANUP: KEEP ONLY MIDDE CHETAN SAI");
  console.log("===============================================================================\n");

  try {
    const chetanUserId = "usr_midde_chetan_sai";
    const chetanEmail = "chetanmidde1@gmail.com";

    // 1. Delete all users except Chetan Sai
    console.log(`🗑️ Deleting all user accounts except '${chetanEmail}' (${chetanUserId})...`);
    
    const deleteRes = await db.query(
      `DELETE FROM public.users WHERE id != $1 AND email != $2`,
      [chetanUserId, chetanEmail]
    );

    console.log(`✅ Deleted ${deleteRes.rowCount} other user account(s) and their cascading profiles, resumes, and saved answers.`);

    // 2. Verify remaining users in public.users
    console.log("\n📊 REMAINING USERS IN DATABASE:");
    console.log("--------------------------------------------------------------------------------");
    
    const usersRes = await db.query("SELECT id, email, created_at FROM public.users");
    usersRes.rows.forEach((u: any) => {
      console.log(`  • ID: ${u.id} | Email: ${u.email} | Created: ${u.created_at}`);
    });

    const profilesRes = await db.query("SELECT * FROM public.user_profiles");
    console.log("\n📊 REMAINING USER PROFILES IN DATABASE:");
    console.log("--------------------------------------------------------------------------------");
    profilesRes.rows.forEach((p: any) => {
      console.log(`  • Name: ${p.first_name} ${p.last_name} | Phone: ${p.phone} | Email/User: ${p.user_id}`);
    });

    const resumesRes = await db.query("SELECT * FROM public.resumes");
    console.log("\n📊 REMAINING RESUMES IN DATABASE:");
    console.log("--------------------------------------------------------------------------------");
    resumesRes.rows.forEach((r: any) => {
      console.log(`  • Resume ID: ${r.id} | File: ${r.file_name} | Path: ${r.file_path}`);
    });

    console.log("\n===============================================================================");
    console.log("🎉 DATABASE CLEANUP COMPLETED - ONLY MIDDE CHETAN SAI REMAINS!");
    console.log("===============================================================================\n");

  } catch (error: any) {
    console.error("❌ Cleanup failed:", error.message);
  } finally {
    await db.close();
    process.exit(0);
  }
}

cleanUsersKeepChetan();
