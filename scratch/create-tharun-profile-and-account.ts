import { db } from "../src/database/db";
import { generateResumePdf, createPersistentBrowserContext } from "../src/browser/browser-manager";
import { saveWellfoundCredentials, WellfoundCredential } from "../src/ats/wellfound/wellfound-account-store";
import { createWellfoundAccount, syncWellfoundProfile, isWellfoundLoggedIn } from "../src/ats/wellfound/wellfound-auth";
import { UserProfile } from "../src/ats/ats.interface";
import fs from "fs";
import path from "path";

async function main() {
  console.log("===============================================================================");
  console.log("🚀 THARUN KOMITE : FULL PROFILE SEEDING & WELLFOUND ACCOUNT CREATION");
  console.log("===============================================================================\n");

  const userId = "usr_tharun_komite";
  const userEmail = "tharunkomite7@gmail.com";
  const firstName = "Tharun";
  const lastName = "Komite";
  const fullName = `${firstName} ${lastName}`;
  const phone = "+1 202 555 0198";
  const wellfoundPassword = process.env.WELLFOUND_PASSWORD || "TharunDev@2024!";

  // 1. Create Resumes Directory
  const resumesDir = path.resolve(__dirname, "../resumes");
  const userResumeDir = path.join(resumesDir, `user_${userId}`);
  if (!fs.existsSync(userResumeDir)) {
    fs.mkdirSync(userResumeDir, { recursive: true });
  }

  const resumeFileName = "Tharun_Komite_Resume.pdf";
  const resumeFilePath = path.join(userResumeDir, resumeFileName);
  const relativeResumePath = `resumes/user_${userId}/${resumeFileName}`;

  const resumeText = `THARUN KOMITE
San Francisco, CA, United States | ${userEmail} | ${phone} | linkedin: https://linkedin.com/in/tharunkomite | github: https://github.com/tharunkomite

SUMMARY
Full-Stack Developer and AI Engineer with hands-on experience building scalable AI-powered applications using Python, Java, FastAPI, React, REST APIs, and modern cloud infrastructure. Strong expertise in RAG systems, NLP, OpenAI APIs, local LLMs, backend architecture, and full-stack development. Experienced in deploying production-ready applications using Docker, Azure App Service, Azure Blob Storage, and modern DevOps workflows. Passionate about building intelligent software products that solve real-world problems.

TECHNICAL SKILLS
Programming Languages: Python, Java, JavaScript, TypeScript
Frameworks & Libraries: FastAPI, Flask, React, Node.js, Next.js, Tailwind CSS, REST APIs
Databases & Backend: PostgreSQL, MySQL, MongoDB, Supabase, Backend Architecture, System Design
Computer Science: Data Structures & Algorithms, Object-Oriented Programming, Software Engineering, System Architecture
DevOps & Cloud: Docker, Azure App Service, Azure Blob Storage, AWS, Git, GitHub, CI/CD
AI / ML: NLP, RAG, FAISS, OpenAI APIs, LangChain, Local LLMs, Vector Databases
Tools: VS Code, Linux, Docker Desktop, Postman

WORK EXPERIENCE
Full Stack AI Developer | Jobspring (Jan 2024 – Present)
- Engineered an AI-powered resume and career optimization platform using OpenAI APIs, serving 500+ active users.
- Designed and implemented scalable FastAPI backend microservices and responsive React workflows.
- Reduced API query response latency by 35% through Redis caching and query indexing optimization.
- Containerized and deployed services using Docker and Azure App Service, streamlining release pipelines.

Full Stack Developer (Freelance) | Nomadic Trails (Sept 2024 – Dec 2024)
- Built interactive frontend dashboards and scalable REST APIs for customer-facing applications.
- Integrated third-party mapping and payment gateways, maintaining 99.9% uptime.
- Developed modular React components and backend services in TypeScript and Node.js.

PROJECTS
LocalMind OS
- Built an offline AI workspace for querying PDFs, repositories, and documentation using local LLMs.
- Implemented a RAG pipeline utilizing FAISS vector similarity search and semantic document retrieval.
- Developed FastAPI backend services for text chunking, embedding generation, and contextual retrieval.

JobSpring – Career AI Engine
- Created an end-to-end ATS matching engine evaluating resumes against job descriptions with real-time feedback.
- Integrated LLM screening interview simulators and automated technical evaluation benchmarks.

EDUCATION
B.Tech, Computer Science Engineering (AI & ML) | Parul University (CGPA: 8.2 / 10)`;

  console.log("📄 1. Generating PDF Resume...");
  await generateResumePdf(resumeFilePath, resumeText).catch((err) => {
    console.warn("⚠️ PDF creation notice:", err.message);
  });

  const coverLetterFileName = "Tharun_Komite_Cover_Letter.pdf";
  const coverLetterFilePath = path.join(userResumeDir, coverLetterFileName);
  const relativeCoverLetterPath = `resumes/user_${userId}/${coverLetterFileName}`;

  const coverLetterText = `THARUN KOMITE
San Francisco, CA, United States | ${userEmail} | ${phone} | linkedin: https://linkedin.com/in/tharunkomite | github: https://github.com/tharunkomite

Dear Hiring Manager,

I am writing to express my enthusiastic interest in joining your engineering team. As a Full-Stack AI Developer with comprehensive experience architecting scalable applications, RAG pipelines, FastAPI backends, and responsive React interfaces, I have a proven track record of delivering reliable, high-performance production systems.

At Jobspring, I developed an AI-powered career platform serving multi-user workloads using OpenAI APIs, optimizing database query flows and reducing API response latency by 35%. I designed and containerized scalable backend services using Docker and Azure App Service, cutting deployment cycles significantly. In addition, my flagship project LocalMind OS demonstrates my depth in local LLM retrieval architectures, FAISS semantic search indexing, and resilient full-stack engineering.

I am particularly excited about your mission and would welcome the opportunity to bring my technical expertise in Python, Node.js, FastAPI, React, and modern AI architectures to your team.

Sincerely,
Tharun Komite`;

  console.log("📄 2. Generating PDF Cover Letter...");
  await generateResumePdf(coverLetterFilePath, coverLetterText).catch((err) => {
    console.warn("⚠️ Cover letter creation notice:", err.message);
  });

  // 2. Seed User in PostgreSQL Database
  console.log("💾 3. Seeding User & User Profile in Database...");
  await db.query(
    `INSERT INTO public.users (id, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [userId, userEmail, "tharun_secure_password_hash_123"]
  );

  const profileId = `prof_${userId}`;
  await db.query(
    `INSERT INTO public.user_profiles (
       id, user_id, first_name, last_name, phone, location,
       linkedin_url, github_url, portfolio_url, work_authorization,
       willing_to_relocate, years_of_experience, gender
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
      firstName,
      lastName,
      phone,
      "San Francisco, CA, United States",
      "https://linkedin.com/in/tharunkomite",
      "https://github.com/tharunkomite",
      "https://tharunkomite.dev",
      "Authorized to Work",
      1,
      2,
      "Male"
    ]
  );

  // Resume entry in resumes table
  const resumeId = `res_${userId}`;
  await db.query(
    `INSERT INTO public.resumes (id, user_id, file_name, file_path, resume_type, is_active)
     VALUES ($1, $2, $3, $4, 'PDF', 1)
     ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_path = EXCLUDED.file_path, is_active = 1`,
    [resumeId, userId, resumeFileName, relativeResumePath]
  );

  const coverLetterDocId = `cov_${userId}`;
  await db.query(
    `INSERT INTO public.resumes (id, user_id, file_name, file_path, resume_type, is_active)
     VALUES ($1, $2, $3, $4, 'COVER_LETTER', 1)
     ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_path = EXCLUDED.file_path, is_active = 1`,
    [coverLetterDocId, userId, coverLetterFileName, relativeCoverLetterPath]
  );

  // 3. Clone and customize all screening answers from Hrutin's 265 questions
  console.log("💾 4. Copying 265+ screening answers customized for Tharun Komite...");
  const hrutinAnswers = await db.query(
    `SELECT normalized_question, answer FROM public.user_saved_answers WHERE user_id = 'usr_hrutin_nammi'`
  );

  for (const row of hrutinAnswers.rows) {
    let ans = row.answer;
    if (typeof ans === "string") {
      ans = ans
        .replace(/Hrutin Nammi/gi, fullName)
        .replace(/Hrutin/gi, firstName)
        .replace(/Nammi/gi, lastName)
        .replace(/babufakemail@gmail\.com/gi, userEmail)
        .replace(/hrutinnammi/gi, "tharunkomite");
    }

    await db.query(
      `INSERT INTO public.user_saved_answers (user_id, normalized_question, answer, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer, updated_at = CURRENT_TIMESTAMP`,
      [userId, row.normalized_question, ans]
    ).catch(() => {});
  }

  // 4. Save Wellfound Credentials
  console.log("🔐 5. Saving Wellfound Credentials Store...");
  const creds: WellfoundCredential = {
    email: userEmail,
    password: wellfoundPassword,
    name: fullName,
    updatedAt: new Date().toISOString()
  };
  await saveWellfoundCredentials(creds);

  // 5. Construct UserProfile Object
  const tharunProfile: UserProfile = {
    userId,
    email: userEmail,
    firstName,
    lastName,
    phone,
    address: "450 Mission St",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    country: "United States",
    location: "San Francisco, CA, United States",
    linkedinUrl: "https://linkedin.com/in/tharunkomite",
    githubUrl: "https://github.com/tharunkomite",
    portfolioUrl: "https://tharunkomite.dev",
    resumePath: relativeResumePath,
    bio: "Full-Stack Developer and AI Engineer specializing in Python, FastAPI, React, RAG, and cloud architecture.",
    workExperience: [
      {
        company: "Jobspring",
        title: "Full Stack AI Developer",
        startDate: "2024-01-01",
        current: true,
        description: "Built scalable AI-powered resume and career platforms using FastAPI, React, and OpenAI APIs."
      }
    ],
    education: [
      {
        institution: "Parul University",
        degree: "B.Tech",
        fieldOfStudy: "Computer Science Engineering (AI & ML)",
        startDate: "2023-08-01",
        endDate: "2027-05-31"
      }
    ],
    skills: ["Python", "JavaScript", "TypeScript", "React", "FastAPI", "Docker", "Node.js", "PostgreSQL", "RAG"]
  };

  console.log("\n===============================================================================");
  console.log("🌐 6. Launching Headed Browser for Wellfound Account Creation...");
  console.log(`👤 Name: ${fullName}`);
  console.log(`📧 Email: ${userEmail}`);
  console.log(`🔑 Password: ${wellfoundPassword}`);
  console.log("===============================================================================\n");

  const context = await createPersistentBrowserContext(false);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  try {
    const signupSuccess = await createWellfoundAccount(page, creds, tharunProfile);
    console.log(`\n🏁 Wellfound Signup Flow Status: ${signupSuccess ? "✅ SUCCESS" : "⚠️ Flow finished (checking session)"}`);

    const loggedIn = await isWellfoundLoggedIn(page);
    console.log(`🔐 Authenticated Session Status: ${loggedIn ? "✅ LOGGED IN" : "❌ NOT LOGGED IN"}`);

    if (loggedIn) {
      console.log("\n🌐 7. Synchronizing Complete Profile & Links on Wellfound...");
      await syncWellfoundProfile(page, tharunProfile);
      console.log("✅ Profile details, social links, and resume successfully synchronized!");
    }

    await page.screenshot({ path: "scratch/tharun_wellfound_final_state.png" });
    console.log("📸 Final screenshot saved to scratch/tharun_wellfound_final_state.png");

  } catch (error: any) {
    console.error("❌ Exception during Wellfound Account Creation:", error);
    await page.screenshot({ path: "scratch/tharun_wellfound_error.png" }).catch(() => {});
  } finally {
    console.log("\n⏳ Keeping browser open for 15 seconds to finalize...");
    await page.waitForTimeout(15000);
    await context.close();
  }

  console.log("\n===============================================================================");
  console.log("🎉 ACCOUNT CREATION & PROFILE SETUP COMPLETED!");
  console.log("===============================================================================");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
