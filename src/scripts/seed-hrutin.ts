import { db } from "../database/db";
import { generateResumePdf } from "../browser/browser-manager";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

export async function seedHrutinUser() {
  console.log("===============================================================================");
  console.log("👤 IMPORTING USER DETAILS: HRUTIN NAMMI");
  console.log("===============================================================================\n");

  const userId = "usr_hrutin_nammi";
  const userEmail = "babufakemail@gmail.com";
  const resumeFileName = "Hrutin_Nammi_Resume.pdf";
  const resumesDir = path.resolve(__dirname, "../../resumes");
  const userResumeDir = path.join(resumesDir, `user_${userId}`);

  if (!fs.existsSync(userResumeDir)) {
    fs.mkdirSync(userResumeDir, { recursive: true });
  }

  const resumeFilePath = path.join(userResumeDir, resumeFileName);

  const hrutinResumeText = `HRUTIN NAMMI
Vadodara, Gujarat, India | babufakemail@gmail.com | +91 86884 23267 | linkedin: https://linkedin.com/in/hrutinnammi | github: https://github.com/hrutinnammi

SUMMARY
Full-Stack Developer and AI Engineer with hands-on experience building scalable AI-powered applications using Python, Java, FastAPI, React, REST APIs, and modern cloud infrastructure. Strong expertise in RAG systems, NLP, OpenAI APIs, local LLMs, backend architecture, and full-stack development. Experienced in deploying production-ready applications using Docker, Azure App Service, Azure Blob Storage, and modern DevOps workflows. Passionate about building intelligent software products that solve real-world problems.

TECHNICAL SKILLS
Programming Languages: Python, Java, JavaScript
Frameworks & Libraries: FastAPI, Flask, React, Tailwind CSS, REST APIs
Databases & Backend: MySQL, MongoDB, Supabase, Backend Architecture, API Development
Computer Science: Data Structures & Algorithms, Object-Oriented Programming, Software Engineering, System Design
DevOps & Cloud: Docker, Azure App Service, Azure Blob Storage, Git, GitHub
AI / ML: NLP, RAG, FAISS, OpenAI APIs, Local LLMs, OpenCV
Tools: Figma, VS Code, Claude, Anti-Gravity, Codex

WORK EXPERIENCE
Full Stack AI Developer | Jobspring (Jan 2024 – Jan 2026)
- Built an AI-powered resume generation platform using OpenAI APIs, generating 50+ customized resumes for users.
- Designed and implemented scalable FastAPI backend services and React frontend workflows for multi-user applications.
- Reduced API response latency by 30% through database query optimization and backend performance improvements.
- Containerized and deployed applications using Docker and Azure App Service, reducing deployment time by 60%.

Full Stack Developer (Freelance) | Nomadic Trails (Sept 2025)
- Delivered full-stack features for a travel-tech platform serving customer-facing applications.
- Built scalable backend APIs and responsive frontend interfaces using modern development practices.
- Integrated third-party APIs for itinerary generation and workflow automation.

PROJECTS
LocalMind OS (Live Demo)
- Built an offline AI workspace for querying PDFs, notes, chat exports, and code repositories using local LLMs.
- Developed a RAG pipeline using FAISS vector search and semantic retrieval for intelligent document querying.
- Implemented document ingestion, chunking, embedding generation, and retrieval workflows.
- Designed FastAPI backend services for indexing, summarization, and conversational AI capabilities.

JobSpring – AI-Powered Career Platform (Live Demo)
- Engineered an AI-powered career platform offering resume building, interview preparation, and application optimization tools.
- Orchestrated ATS-friendly resume generation workflows with personalized recommendations based on job descriptions.
- Integrated AI-driven interview coaching systems that provide real-time feedback and placement readiness support.

SkillSense AI (Live Demo)
- Architected an AI-powered platform for technical skill assessment and placement readiness evaluation.
- Developed automated analysis pipelines for resumes, GitHub repositories, and coding profiles.
- Designed candidate scoring workflows using NLP and OpenAI APIs.

ACHIEVEMENTS & LEADERSHIP
- SSIP Startup Funding Recipient – Awarded 1 Lakh startup funding support.
- Smart India Hackathon 2024 – University Finalist.
- HackVerse 2025 – Top 5 Finalist.
- Senior Head, CodeX Fusion Coding Community – Mentored 300+ students in AI, Data Structures & Algorithms.

EDUCATION
B.Tech, Computer Science Engineering (AI & ML) | Parul University – CGPA: 7.1 / 10 (Expected 2027)`;

  // 1. Generate PDF Resume
  console.log("📄 Generating PDF resume for Hrutin Nammi...");
  try {
    await generateResumePdf(resumeFilePath, hrutinResumeText);
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
    [userId, userEmail, "hrutin_secure_password_hash_123"]
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
      "Hrutin",
      "Nammi",
      "8688423267",
      "Vadodara, Gujarat, India",
      "https://linkedin.com/in/hrutinnammi",
      "https://github.com/hrutinnammi",
      "https://github.com/hrutinnammi",
      "Authorized to Work",
      1,
      2,
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
    name: "Hrutin Nammi",
    full_name: "Hrutin Nammi",
    first_name: "Hrutin",
    last_name: "Nammi",
    legal_name: "Hrutin Nammi",
    legal_last_name: "Nammi",
    email: userEmail,
    phone: "8688423267",
    mobile: "8688423267",
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
    linkedin: "https://linkedin.com/in/hrutinnammi",
    github: "https://github.com/hrutinnammi",
    portfolio: "https://github.com/hrutinnammi",
    website: "https://github.com/hrutinnammi",
    x: "https://x.com/hrutin_dev",
    twitter: "https://x.com/hrutin_dev",
    x_url: "https://x.com/hrutin_dev",
    twitter_url: "https://x.com/hrutin_dev",
    education: "Parul University",
    school: "Parul University",
    university: "Parul University",
    college: "Parul University",
    degree: "Bachelor of Technology",
    major: "Computer Science Engineering (AI & ML)",
    discipline: "Computer Science Engineering (AI & ML)",
    graduation_year: "2027",
    graduation_date: "Expected 2027",
    cgpa: "7.1",
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
    current_company: "Jobspring",
    current_title: "Full Stack AI Developer",
    years_of_experience: "2",
    relocate: "Yes",
    willing_to_relocate: "Yes",
    skills: "Python, Java, JavaScript, FastAPI, Flask, React, Tailwind CSS, REST APIs, MySQL, MongoDB, Supabase, Docker, Azure App Service, Azure Blob Storage, NLP, RAG, FAISS, OpenAI APIs, Local LLMs, OpenCV",
    summary: "Full-Stack Developer and AI Engineer with hands-on experience building scalable AI-powered applications using Python, Java, FastAPI, React, REST APIs, and modern cloud infrastructure.",
    experience: "Full Stack AI Developer at Jobspring (Jan 2024 - Jan 2026), Full Stack Developer Freelance at Nomadic Trails (Sept 2025)",
    cover_letter: "Dear Hiring Manager,\n\nI am a Full-Stack AI Developer experienced in building scalable AI applications, RAG pipelines, FastAPI backends, and React interfaces. At Jobspring, I developed an AI resume platform serving 50+ users and reduced API latency by 30%. I am excited to bring my expertise in Python, React, LLMs, and cloud deployments to your team.\n\nBest regards,\nHrutin Nammi",
    "cover letter": "Dear Hiring Manager,\n\nI am a Full-Stack AI Developer experienced in building scalable AI applications, RAG pipelines, FastAPI backends, and React interfaces. At Jobspring, I developed an AI resume platform serving 50+ users and reduced API latency by 30%. I am excited to bring my expertise in Python, React, LLMs, and cloud deployments to your team.\n\nBest regards,\nHrutin Nammi",
    "tell us more": "One of my flagship projects is LocalMind OS—an offline AI workspace for querying PDFs, code repositories, and notes using local LLMs. I developed a RAG pipeline utilizing FAISS vector search, document chunking, and FastAPI backend services to enable intelligent semantic retrieval and conversational AI capabilities.",
    "tell us about something you built": "One of my flagship projects is LocalMind OS—an offline AI workspace for querying PDFs, code repositories, and notes using local LLMs. I developed a RAG pipeline utilizing FAISS vector search, document chunking, and FastAPI backend services to enable intelligent semantic retrieval and conversational AI capabilities.",
    project: "One of my flagship projects is LocalMind OS—an offline AI workspace for querying PDFs, code repositories, and notes using local LLMs. I developed a RAG pipeline utilizing FAISS vector search, document chunking, and FastAPI backend services to enable intelligent semantic retrieval and conversational AI capabilities.",
    projects: "1. LocalMind OS: Built an offline AI workspace with FAISS vector search and RAG pipelines using local LLMs.\n2. JobSpring: Engineered an AI career platform for automated ATS resume generation and real-time interview coaching using OpenAI APIs.\n3. SkillSense AI: Architected a technical skill assessment platform using NLP and candidate scoring workflows.",
    achievements: "Awarded SSIP Startup Funding support of 1 Lakh for our HR Tech startup and reached the finals in Smart India Hackathon 2024 and HackVerse 2025.",
    leadership: "Served as Senior Head of CodeX Fusion Coding Community, mentoring 300+ students in AI, Data Structures & Algorithms, and software solutions.",
    why_do_you_want_to_work_here: "I am passionate about building AI-powered web applications and scalable cloud architecture, and eager to bring my expertise in FastAPI, React, RAG pipelines, and LLM integrations to your team.",
    technical_issue: "While developing LocalMind OS, I optimized document chunking and FAISS vector index retrieval pipelines, reducing query latency by 30% for local LLM text generation under heavy payload bursts.",
    operational_improvement: "Engineered JobSpring resume generation workflows using OpenAI APIs, containerized services with Docker and Azure App Service, cutting deployment cycles by 60%.",
    referral: "Tarun Komati",
    referred: "Tarun Komati",
    referred_by: "Tarun Komati",
    reference: "Tarun Komati",
    reference_name: "Tarun Komati",
    referral_name: "Tarun Komati",
    who_referred_you: "Tarun Komati",
    "has someone at linear referred you for this role if so please include their name here": "Tarun Komati",
    "if you were referred by an employee, please list their name": "Tarun Komati",
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

  console.log(`\n🎉 SUCCESS: Candidate Hrutin Nammi created and seeded in database!`);
  console.log(`   - ID: ${userId}`);
  console.log(`   - Email: ${userEmail}`);
  console.log(`   - Resume: ${relativeResumePath}`);
}

if (require.main === module) {
  seedHrutinUser()
    .then(() => db.close())
    .catch((err) => {
      console.error("❌ Error seeding Hrutin:", err);
      db.close();
      process.exit(1);
    });
}
