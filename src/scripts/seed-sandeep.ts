import { db } from "../database/db";
import { generateResumePdf } from "../browser/browser-manager";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

export async function seedSandeepUser() {
  console.log("===============================================================================");
  console.log("👤 IMPORTING USER DETAILS: SAI SANDEEP YALLA (USER 2)");
  console.log("===============================================================================\n");

  const userId = "usr_sai_sandeep_yalla";
  const userEmail = "sandeep.yalla506@gmail.com";
  const resumeFileName = "Sai_Sandeep_Yalla_Resume.pdf";
  const resumesDir = path.resolve(__dirname, "../../resumes");
  const userResumeDir = path.join(resumesDir, `user_${userId}`);

  if (!fs.existsSync(userResumeDir)) {
    fs.mkdirSync(userResumeDir, { recursive: true });
  }

  const resumeFilePath = path.join(userResumeDir, resumeFileName);

  const sandeepResumeText = `SAI SANDEEP YALLA
+91 9390424821 | sandeep.yalla506@gmail.com | github: https://github.com/sandeep-yalla | linkedin: https://linkedin.com/in/saisandeep

SUMMARY
Computer Science student specializing in Artificial Intelligence with hands-on experience building full-stack MERN applications. Skilled in React.js, Node.js, and real-time systems. Experienced in developing collaborative platforms and deploying applications using modern tools like Vercel and Render.

EDUCATION
Parul University, Vadodara, Gujarat (Expected: May 2027)
Bachelor of Science in Computer Science (Artificial Intelligence)

TECHNICAL SKILLS
Languages: JavaScript, Python, Java
Frameworks & Libraries: React.js, Node.js, Express.js, WebSockets, Socket.io
Databases: MongoDB, MySQL
Cloud: AWS (EC2, S3, Lambda, IAM, CloudWatch)
Version Control: Git, GitHub
Tools: Vercel, Render, GitHub Copilot

PROJECTS
Oxford School Fee Management System
- Built full-stack web app for Oxford School with role-based auth: Staff and Admin logins with JWT, handling 2-tier access control.
- Designed modules for Student Info, Course/Books/Transport fee collection, Fee History, and Pending Fee tracking for Nursery to Class 10.
- Implemented payment flow with multiple modes: Cash, QR, Bank, Card; auto-generates printable receipts and updates pending balances in real time. Developed reporting dashboard showing daily, weekly, and monthly income with day/week/month filters to help admin reconcile collections.
- CRUD operations. Enabled Staff to add/edit student records and Admin to manage fee structures; added search & filter across classes to quickly access student profiles.

CERTIFICATIONS
- Technology Job Simulation at Deloitte (Forage), April 2026
- Generative AI for All by Infosys Springboard

CODING PROFILES
LeetCode: Sandeep`;

  // 1. Generate PDF Resume
  console.log("📄 Generating PDF resume for Sai Sandeep Yalla...");
  try {
    await generateResumePdf(resumeFilePath, sandeepResumeText);
    console.log(`✅ Resume PDF created at: ${resumeFilePath}`);
  } catch (e: any) {
    console.warn("⚠️ PDF generation warning:", e.message);
  }

  // Ensure column gender exists on user_profiles if needed
  await db.query("ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS gender text DEFAULT 'Male'").catch(() => {});

  // 2. Insert/Update `users` table
  console.log("👤 Creating user record in `public.users`...");
  await db.query(
    `INSERT INTO public.users (id, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [userId, userEmail, "sandeep_secure_password_hash_123"]
  );

  // 3. Insert/Update `user_profiles` table
  console.log("📝 Creating profile record in `public.user_profiles`...");
  const profileId = `prof_${userId}`;
  await db.query(
    `INSERT INTO public.user_profiles (
       id, user_id, first_name, last_name, phone, location, 
       linkedin_url, github_url, portfolio_url, work_authorization, 
       willing_to_relocate, years_of_experience, gender
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (user_id) DO UPDATE SET
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       phone = EXCLUDED.phone,
       location = EXCLUDED.location,
       linkedin_url = EXCLUDED.linkedin_url,
       github_url = EXCLUDED.github_url,
       portfolio_url = EXCLUDED.portfolio_url,
       work_authorization = EXCLUDED.work_authorization,
       willing_to_relocate = EXCLUDED.willing_to_relocate,
       years_of_experience = EXCLUDED.years_of_experience,
       gender = EXCLUDED.gender`,
    [
      profileId,
      userId,
      "Sai Sandeep",
      "Yalla",
      "+91 9390424821",
      "Vadodara, Gujarat, India",
      "https://linkedin.com/in/saisandeep",
      "https://github.com/sandeep-yalla",
      "https://leetcode.com/u/Sandeep",
      "Authorized to Work",
      1,
      1,
      "Male"
    ]
  );

  // 4. Insert/Update `resumes` table
  console.log("📄 Registering resume in `public.resumes`...");
  const resumeId = `res_${userId}`;
  const relativeResumePath = `resumes/user_${userId}/${resumeFileName}`;
  await db.query(
    `INSERT INTO public.resumes (id, user_id, file_name, file_path, resume_type, is_active)
     VALUES ($1, $2, $3, $4, 'PDF', 1)
     ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_path = EXCLUDED.file_path, is_active = 1`,
    [resumeId, userId, resumeFileName, relativeResumePath]
  );

  // 5. Insert screening & saved answers in `public.user_saved_answers` table
  console.log("💾 Populating screening & essay answers in `public.user_saved_answers`...");
  const answersMap: Record<string, string> = {
    name: "Sai Sandeep Yalla",
    full_name: "Sai Sandeep Yalla",
    first_name: "Sai Sandeep",
    last_name: "Yalla",
    email: userEmail,
    phone: "+91 9390424821",
    mobile: "+91 9390424821",
    location: "Vadodara, Gujarat, India",
    city: "Vadodara",
    state: "Gujarat",
    country: "India",
    gender: "Male",
    gender_identity: "Male",
    what_is_your_gender: "Male",
    pronouns: "He/Him",
    age: "Under 30",
    age_group: "Under 30",
    what_is_your_age: "Under 30",
    are_you_over_18: "Yes",
    are_you_at_least_18_years_old: "Yes",
    linkedin: "https://linkedin.com/in/saisandeep",
    github: "https://github.com/sandeep-yalla",
    portfolio: "https://leetcode.com/u/Sandeep",
    website: "https://leetcode.com/u/Sandeep",
    education: "Parul University",
    school: "Parul University",
    university: "Parul University",
    college: "Parul University",
    degree: "Bachelor of Science",
    major: "Computer Science (Artificial Intelligence)",
    discipline: "Computer Science (Artificial Intelligence)",
    graduation_year: "2027",
    graduation_date: "May 2027",
    work_authorization: "Yes",
    are_you_legally_authorized_to_work: "Yes",
    sponsorship: "No",
    will_you_now_or_in_the_future_require_sponsorship: "No",
    notice_period: "Immediate",
    start_date: "Immediate",
    salary_expectation: "Negotiable",
    expected_salary: "Negotiable",
    compensation: "Negotiable",
    working_hours: "Flexible / Full-time",
    work_week: "Available full-time Monday through Friday during standard business hours.",
    working_through_the_week: "Available full-time Monday through Friday during standard business hours.",
    availability: "Immediate full-time availability",
    schedule: "Full-time (Monday - Friday)",
    current_company: "Parul University",
    current_title: "Full-Stack AI Developer",
    years_of_experience: "1",
    relocate: "Yes",
    willing_to_relocate: "Yes",
    why_do_you_want_to_work_here: "I am passionate about full-stack development and AI integration, and excited to build scalable web applications and real-time systems with your engineering team.",
    technical_issue: "While building the Oxford School Fee Management System, I optimized complex SQL aggregation queries and JWT access control flows, reducing database response times by 45%.",
    how_did_you_hear_about_us: "LinkedIn"
  };

  for (const [question, answer] of Object.entries(answersMap)) {
    const id = uuidv4();
    await db.query(
      `INSERT INTO public.user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
       VALUES ($1, $2, $3, $4, $5, 'SEED')
       ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer, updated_at = CURRENT_TIMESTAMP`,
      [id, userId, question, question, answer]
    );
  }

  console.log(`\n🎉 SUCCESS: User 2 (Sai Sandeep Yalla) created and seeded in database!`);
  console.log(`   - ID: ${userId}`);
  console.log(`   - Email: ${userEmail}`);
  console.log(`   - Resume: ${relativeResumePath}`);
}

if (require.main === module) {
  seedSandeepUser()
    .then(() => db.close())
    .catch((err) => {
      console.error("❌ Error seeding Sandeep:", err);
      db.close();
      process.exit(1);
    });
}
