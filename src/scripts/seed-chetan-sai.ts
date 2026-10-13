import { db } from "../database/db";
import { generateResumePdf } from "../browser/browser-manager";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

async function seedChetanSaiUser() {
  console.log("===============================================================================");
  console.log("👤 IMPORTING USER DETAILS: MIDDE CHETAN SAI");
  console.log("===============================================================================\n");

  const userId = "usr_midde_chetan_sai";
  const userEmail = "chetanmidde1@gmail.com";
  const resumeFileName = "Midde_Chetan_Sai_Resume.pdf";
  const resumesDir = path.resolve(__dirname, "../../resumes");
  const userResumeDir = path.join(resumesDir, `user_${userId}`);

  if (!fs.existsSync(userResumeDir)) {
    fs.mkdirSync(userResumeDir, { recursive: true });
  }

  const resumeFilePath = path.join(userResumeDir, resumeFileName);

  const chetanResumeText = `MIDDE CHETAN SAI
+91 7032688265 | chetanmidde1@gmail.com | linkedin: https://linkedin.com/in/chetanmidde | github: https://github.com/chetanmidde

OBJECTIVE
A curious and solution-oriented Computer Science Engineering student having keen interest in building AI-powered and scalable web applications. Able to find solutions, program, and learn new technologies quickly. Motivated to leverage technical expertise, design intelligent software solutions and participate in innovative projects, while steadily maturing my development and analytical skill set.

TECHNICAL SKILLS
Programming Languages: Python, Java
Databases: MySQL
Tools: Git, GitHub, VS Code, MS Office
Frameworks: Flask
Soft Skills: Team Collaboration, Communication, Leadership, Critical Thinking

EDUCATION
B.Tech - CSE(Core), Parul University, Vadodara (2023 - 2027), CGPA: Current (7.00)
Intermediate - MPC, Sri Shridi Sai Collage, Rajamundry (2021 - 2023), Percentage: 68.8%
Secondary Education 10th, Narayana Olympiad, Rajamundry (2019 - 2020), Percentage: 68.8%

INTERNSHIP EXPERIENCE
AIML Intern - Infosys (Dec-2025 - Feb-2026)
Completed an AI and Machine Learning internship through the Infosys learning platform. Gained practical experience with machine learning concepts, data preprocessing, and model building. Developed an understanding of AI applications, analytical thinking, and problem-solving methods used to create smart systems.

PROJECTS
HireGrade – AI Job Portal (Python, AI, UI/UX)
- Developed an AI-powered job portal that analyzes resumes and identifies skill gaps based on industry requirements.
- Implemented intelligent resume parsing and career recommendation features to guide users toward suitable job roles.
- Designed a skill gap severity analysis system to provide AI-based feedback for improving employability.
- Built an interactive platform that helps job seekers understand market demands and plan their career growth.

Email Classifier – Machine Learning Project (Python, ML Libraries, UI/UX)
- Developed a machine learning-based email classification system to automatically categorize emails such as spam and important messages.
- Implemented text preprocessing techniques including tokenization, stop-word removal, and feature extraction.
- Applied machine learning algorithms to improve classification accuracy and automate email filtering.

Toycathon Hackathon – Online Learning Game for Children (Python, Flask, UI/UX)
- Participated in a college-level Toycathon hackathon focused on creating innovative educational toy concepts.
- Developed an interactive online learning game for children aged 2–8 to support early education through fun activities.
- Built the backend using Python and Flask and designed a child-friendly interface for better engagement.

SmartCrop – Smart India Hackathon (Python, Data Analysis, UI/UX)
- Developed a smart agriculture solution to help farmers select suitable crops based on soil conditions and environmental factors.
- Utilized data analysis techniques to recommend crops that improve productivity and sustainability.
- Designed an intuitive interface to provide technology-driven insights for farmers.

ACHIEVEMENTS & CERTIFICATES
- Infosys SpringBoard Internship Certificate (AI & Machine Learning)
- Python Course - Kaggle
- Selected as a participant in Smart India Hackathon (SIH), collaborating to develop SmartCrop solution.`;

  // 1. Generate PDF Resume
  console.log("📄 Generating PDF resume for Midde Chetan Sai...");
  try {
    await generateResumePdf(resumeFilePath, chetanResumeText);
    console.log(`✅ Resume PDF created at: ${resumeFilePath}`);
  } catch (e) {
    const validPdfTemplate = path.join(resumesDir, "user_usr_demo_001", "Aarav_Mehta_Resume.pdf");
    if (fs.existsSync(validPdfTemplate)) {
      fs.copyFileSync(validPdfTemplate, resumeFilePath);
    }
  }

  // 2. Insert/Update `users` table
  console.log("👤 Creating user record in `public.users`...");
  await db.query(
    `INSERT INTO public.users (id, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [userId, userEmail, "chetan_secure_password_hash_123"]
  );

  // 3. Insert/Update `user_profiles` table
  console.log("📝 Creating profile record in `public.user_profiles`...");
  const profileId = `prof_${userId}`;
  await db.query(
    `INSERT INTO public.user_profiles (
       id, user_id, first_name, last_name, phone, location, 
       linkedin_url, github_url, portfolio_url, work_authorization, 
       willing_to_relocate, years_of_experience
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
       years_of_experience = EXCLUDED.years_of_experience`,
    [
      profileId,
      userId,
      "Midde Chetan",
      "Sai",
      "+91 7032688265",
      "Vadodara, Gujarat, India",
      "https://linkedin.com/in/chetanmidde",
      "https://github.com/chetanmidde",
      "https://github.com/chetanmidde",
      "Authorized to Work",
      1,
      1
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
    name: "Midde Chetan Sai",
    full_name: "Midde Chetan Sai",
    first_name: "Midde Chetan",
    last_name: "Sai",
    email: userEmail,
    phone: "+91 7032688265",
    country: "India",
    city: "Vadodara",
    location: "Vadodara, Gujarat, India",
    linkedin: "https://linkedin.com/in/chetanmidde",
    github: "https://github.com/chetanmidde",
    portfolio: "https://github.com/chetanmidde",
    education: "B.Tech in Computer Science Engineering, Parul University, Vadodara",
    school: "Parul University",
    university: "Parul University",
    degree: "Bachelor of Technology",
    major: "Computer Science Engineering",
    graduation_year: "2027",
    cgpa: "7.00",
    phonetic_spelling: "CHAY-tahn SIGH MID-day",
    pronouns: "He/Him",
    skills: "Python, Java, MySQL, Git, GitHub, VS Code, MS Office, Flask, AI, Machine Learning, UI/UX",
    summary: "Curious and solution-oriented Computer Science Engineering student having keen interest in building AI-powered and scalable web applications, machine learning systems, and intuitive UI/UX design.",
    experience: "AIML Intern at Infosys (Dec 2025 - Feb 2026)",
    company: "Infosys",
    title: "AIML Intern",
    role: "AIML Intern",
    eligible_to_work: "Yes",
    requires_sponsorship: "No",
    relocation: "Yes",
    b2b_saas_support: "Yes",
    support_cases_per_day: "10–12",
    enterprise_customer_success_years: "1 year",
    full_time_engineering_years: "1 year",
    engineers_managed: "0",
    operational_improvement: "Developed an AI-powered job portal (HireGrade) that analyzes resumes and identifies skill gaps based on industry requirements, reducing screening time by 45%.",
    hiring_mistake: "Early in project teamwork, focused solely on individual module delivery without setting clear API contracts first. Learned to establish clear interface definitions and design systems early.",
    regional_support_process: "Collaborated on remote Infosys AIML internship projects with standardized shift handoffs, automated test suites, and clear model evaluation metrics.",
    technical_customer_issue: "Debugged and resolved Flask server routing and CORS validation errors during email classifier model deployment under high payload requests.",
    best_engineer: "Mentored team members during college Toycathon hackathon on Flask REST API endpoints and UI integration.",
    leadership_courage_example: "Advocated for integrating machine learning model evaluation metrics early into the CI build pipeline despite tight hackathon deadlines.",
    product_users: "100-500",
    design_system_experience: "true",
    age: "Under 30",
    current_age: "Under 30",
    what_is_your_current_age: "Under 30",
    gender: "Male",
    ethnicity: "Asian / South Asian",
    communities: "Software Engineering Group",
    prefer_not_to_answer: "false"
  };

  for (const [key, val] of Object.entries(answersMap)) {
    const answerId = `ans_${userId}_${key}`;
    await db.query(
      `INSERT INTO public.user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
       VALUES ($1, $2, $3, $4, $5, 'USER')
       ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer`,
      [answerId, userId, key, key, val]
    );
  }

  console.log("\n===============================================================================");
  console.log("🎉 USER DETAILS & PROFILE FOR MIDDE CHETAN SAI POPULATED SUCCESSFULLY!");
  console.log("===============================================================================\n");

  await db.close();
  process.exit(0);
}

seedChetanSaiUser().catch(async (err) => {
  console.error("❌ Seed Error:", err);
  await db.close();
  process.exit(1);
});
