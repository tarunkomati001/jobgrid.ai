import { db } from "../database/db";
import fs from "fs";
import path from "path";

async function applyKomatiTarunResume() {
  console.log("⚡ CLUCO.AI: Applying KOMATI TARUN's Resume & Profile details to ALL users EXCEPT Aarav Mehta...");

  const resumesDir = path.resolve(__dirname, "../../resumes");
  const templatePdfPath = path.join(resumesDir, "user_bb5c54fd-79ee-41fd-917b-6553a09195d1", "Aarav_Mehta_Resume.pdf");

  if (!fs.existsSync(templatePdfPath)) {
    console.error("❌ Template PDF not found at:", templatePdfPath);
    process.exit(1);
  }

  const validPdfBuffer = fs.readFileSync(templatePdfPath);

  // 1. Fetch all users except Aarav Mehta
  const usersRes = await db.query(
    "SELECT id, email FROM users WHERE id != 'usr_demo_001' AND id != 'bb5c54fd-79ee-41fd-917b-6553a09195d1' AND email NOT LIKE '%aarav%'"
  );

  const nonAaravUsers = usersRes.rows;
  console.log(`👤 Found ${nonAaravUsers.length} user(s) to update with Komati Tarun's profile & resume.\n`);

  let count = 0;

  for (const user of nonAaravUsers) {
    const userIndex = count + 2;
    const userEmail = `tarunkomati2+user${userIndex}@gmail.com`;
    const resumeFileName = "Komati_Tarun_Resume.pdf";
    const userResumeDir = path.join(resumesDir, `user_${user.id}`);

    if (!fs.existsSync(userResumeDir)) {
      fs.mkdirSync(userResumeDir, { recursive: true });
    }

    const resumeFilePath = path.join(userResumeDir, resumeFileName);
    fs.writeFileSync(resumeFilePath, validPdfBuffer);

    // Update user profile in DB
    await db.query(
      `UPDATE user_profiles SET
         first_name = 'Komati',
         last_name = 'Tarun',
         phone = '+91 8498893208',
         location = 'Vadodara, Gujarat, India',
         linkedin_url = 'https://linkedin.com/in/komati-tarun',
         github_url = 'https://github.com/komatitarun',
         portfolio_url = 'https://komatitarun.dev',
         work_authorization = 'Authorized to Work',
         willing_to_relocate = 1,
         years_of_experience = 2
       WHERE user_id = $1`,
      [user.id]
    );

    // Update active resume in DB
    const relativePath = `resumes/user_${user.id}/${resumeFileName}`;
    await db.query(
      `INSERT INTO resumes (id, user_id, file_name, file_path, resume_type, is_active)
       VALUES ($1, $2, $3, $4, 'PDF', 1)
       ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_path = EXCLUDED.file_path, is_active = 1`,
      [`res_${user.id}`, user.id, resumeFileName, relativePath]
    );

    // Update specific answers in user_saved_answers for Komati Tarun
    const tarunAnswers: Record<string, string> = {
      name: "Komati Tarun",
      full_name: "Komati Tarun",
      first_name: "Komati",
      last_name: "Tarun",
      email: "tarunkomati2@gmail.com",
      phone: "+91 8498893208",
      country: "India",
      city: "Vadodara",
      location: "Vadodara, Gujarat, India",
      linkedin: "https://linkedin.com/in/komati-tarun",
      github: "https://github.com/komatitarun",
      portfolio: "https://komatitarun.dev",
      education: "Bachelor of Technology in AIML, Parul University, Vadodara",
      school: "Parul University",
      university: "Parul University",
      degree: "Bachelor of Technology",
      major: "Artificial Intelligence and Machine Learning",
      graduation_year: "2027",
      cgpa: "8.00",
      phonetic_spelling: "TAH-roon koh-MAH-tee",
      pronouns: "He/Him",
      skills: "JavaScript, Java, Python, C#, React, HTML/CSS, Database Management, Web Development",
      summary: "Dedicated AIML & Frontend Developer skilled in building interactive web applications and intelligent solutions.",
      experience: "Web Development Intern at ShadowFox (Nov 2024)",
      company: "ShadowFox",
      title: "Frontend Developer Intern",
      role: "Web Development Intern",
    };

    for (const [key, val] of Object.entries(tarunAnswers)) {
      const answerId = `ans_${user.id}_${key}`;
      await db.query(
        `INSERT INTO user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
         VALUES ($1, $2, $3, $4, $5, 'USER')
         ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer`,
        [answerId, user.id, key, key, val]
      );
    }

    count++;
    console.log(`  ✅ Updated candidate account ${user.id} -> Komati Tarun (${userEmail})`);
  }

  console.log(`\n🎉 Successfully updated ${count} user profiles & resumes to KOMATI TARUN!`);
  await db.close();
  process.exit(0);
}

applyKomatiTarunResume().catch(async (err) => {
  console.error("❌ Failed to apply Komati Tarun resume:", err);
  await db.close();
  process.exit(1);
});
