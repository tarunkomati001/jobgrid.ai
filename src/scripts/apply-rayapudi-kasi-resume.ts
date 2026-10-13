import { db } from "../database/db";
import fs from "fs";
import path from "path";

async function applyRayapudiKasiResume() {
  console.log("⚡ CLUCO.AI: Applying RAYAPUDI KASI's Resume & Profile details to Candidate accounts (usr_demo_003 to usr_demo_015)...");

  const resumesDir = path.resolve(__dirname, "../../resumes");
  const validPdfTemplate = path.join(resumesDir, "user_usr_demo_001", "Aarav_Mehta_Resume.pdf");

  if (!fs.existsSync(validPdfTemplate)) {
    console.error("❌ Valid PDF template not found at:", validPdfTemplate);
    process.exit(1);
  }

  const validPdfBuffer = fs.readFileSync(validPdfTemplate);

  // Users to update: usr_demo_003 through usr_demo_015
  const usersRes = await db.query(
    "SELECT id FROM users WHERE id LIKE 'usr_demo_%' AND id != 'usr_demo_001' AND id != 'usr_demo_002' ORDER BY id ASC"
  );

  const kasiUsers = usersRes.rows;
  console.log(`👤 Found ${kasiUsers.length} user(s) to update with Rayapudi Kasi's profile & resume.\n`);

  let count = 0;

  for (const user of kasiUsers) {
    const userNum = count + 3;
    const userEmail = userNum === 3 ? "rayapudikasi2005@gmail.com" : `rayapudikasi2005+user${userNum}@gmail.com`;
    const resumeFileName = "Rayapudi_Kasi_Resume.pdf";
    const userResumeDir = path.join(resumesDir, `user_${user.id}`);

    if (!fs.existsSync(userResumeDir)) {
      fs.mkdirSync(userResumeDir, { recursive: true });
    }

    const resumeFilePath = path.join(userResumeDir, resumeFileName);
    fs.writeFileSync(resumeFilePath, validPdfBuffer);

    // Update user in users table
    await db.query("UPDATE users SET email = $1 WHERE id = $2", [userEmail, user.id]);

    // Update user profile in DB
    await db.query(
      `UPDATE user_profiles SET
         first_name = 'Rayapudi',
         last_name = 'Kasi',
         phone = '+91 7799304109',
         location = 'Vadodara, Gujarat, India',
         linkedin_url = 'https://linkedin.com/in/rayapudi-kasi',
         github_url = 'https://github.com/KasiRayapudi',
         portfolio_url = 'https://github.com/KasiRayapudi/Growmart',
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

    // Update specific answers in user_saved_answers for Rayapudi Kasi
    const kasiAnswers: Record<string, string> = {
      name: "Rayapudi Kasi",
      full_name: "Rayapudi Kasi",
      first_name: "Rayapudi",
      last_name: "Kasi",
      email: userEmail,
      phone: "+91 7799304109",
      country: "India",
      city: "Vadodara",
      location: "Vadodara, Gujarat, India",
      linkedin: "https://linkedin.com/in/rayapudi-kasi",
      github: "https://github.com/KasiRayapudi",
      portfolio: "https://github.com/KasiRayapudi/Growmart",
      education: "Bachelor of Technology in AIML, Parul University, Vadodara",
      school: "Parul University",
      university: "Parul University",
      degree: "Bachelor of Technology",
      major: "Artificial Intelligence and Machine Learning",
      graduation_year: "2027",
      cgpa: "7.93",
      phonetic_spelling: "ray-ah-POO-dee KAH-see",
      pronouns: "He/Him",
      skills: "Python, Java, JavaScript, TypeScript, HTML, CSS, React.js, Node.js, Machine Learning, MySQL, MongoDB, Git, GitHub, VS Code",
      summary: "Dedicated final year AIML student at Parul University, passionate about AI, machine learning, and web development. Excel in building intelligent solutions and interactive web applications.",
      project: "Grow Mart - E-commerce Web Application (TypeScript, React, Node.js)",
      experience: "Developer & AIML Student at Parul University",
      company: "Parul University",
      title: "Python & ML Developer",
      role: "Python & ML Developer",
    };

    for (const [key, val] of Object.entries(kasiAnswers)) {
      const answerId = `ans_${user.id}_${key}`;
      await db.query(
        `INSERT INTO user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
         VALUES ($1, $2, $3, $4, $5, 'USER')
         ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer`,
        [answerId, user.id, key, key, val]
      );
    }

    count++;
    console.log(`  ✅ Updated candidate account ${user.id} -> Rayapudi Kasi (${userEmail})`);
  }

  console.log(`\n🎉 Successfully updated ${count} user accounts to RAYAPUDI KASI!`);

  // Verify final user roster
  const verify = await db.query(
    "SELECT p.user_id, p.first_name, p.last_name, u.email FROM user_profiles p JOIN users u ON p.user_id = u.id ORDER BY p.user_id ASC"
  );

  console.log("\n📋 Final Clean User Roster in Database:");
  verify.rows.forEach((u: any, i: number) => {
    console.log(`   [User ${i + 1}] Name: ${u.first_name} ${u.last_name} | Email: ${u.email}`);
  });

  await db.close();
  process.exit(0);
}

applyRayapudiKasiResume().catch(async (err) => {
  console.error("❌ Failed to apply Rayapudi Kasi resume:", err);
  await db.close();
  process.exit(1);
});
