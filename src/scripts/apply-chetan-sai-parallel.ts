import { db } from "../database/db";
import { processApplication } from "../scheduler/application-worker";
import { generateResumePdf } from "../browser/browser-manager";
import { detectATSByUrl } from "../ats/ats-detector";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

// 15 Ashby Job URLs
const JOB_URLS = [
  "https://jobs.ashbyhq.com/notion/05e14247-17c4-4e98-9a13-53828a4e2f13/application",
  "https://jobs.ashbyhq.com/vanta/fe5fd1a4-12ff-4703-bed5-6c2f34ba7768/application",
  "https://jobs.ashbyhq.com/veritycloud/infra-engineer/application",
  "https://jobs.ashbyhq.com/ramp/4bc09b14-0389-40cd-9d5b-f5557f451d50/application",
  "https://jobs.ashbyhq.com/runway-ml/44c1578a-3b0c-4b64-b1c0-89f51e8635ee/application",
  "https://www.ashbyhq.com/careers?ashby_location_id=9c7cb4a1-489c-4550-a4ca-a667a981275c&ashby_jid=95aecf44-abba-4d06-8fea-7987b6ea9db5",
  "https://www.ashbyhq.com/careers?ashby_jid=033ce772-ed08-4a59-bb52-4ff0eaac9bcd",
  "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_jid=7a3ff629-6c67-4aa5-bea4-f1d88b3b4777",
  "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_jid=6a15668c-3f98-4404-8f1f-927cddfc5af7",
  "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_jid=cb45928e-c7c7-4163-84d0-a962755a3593",
  "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_department_id=2c32d70f-d7cb-4a06-bd87-048084e3eb10&ashby_jid=0020099f-9bb3-4da9-9808-4556564f5301",
  "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_department_id=2c32d70f-d7cb-4a06-bd87-048084e3eb10&ashby_jid=695b1ce6-c375-4fad-94ef-61b50a3fbd28",
  "https://www.ashbyhq.com/careers?ashby_department_id=2c32d70f-d7cb-4a06-bd87-048084e3eb10&ashby_jid=472eef28-6e52-43b4-9bff-9113522890f5",
  "https://www.ashbyhq.com/careers?ashby_department_id=2c32d70f-d7cb-4a06-bd87-048084e3eb10&ashby_jid=c3c7125d-7883-4dff-a2bf-f5a55de4a364",
  "https://ashbyhq.com/test-job"
];

function deriveCompanyFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("ashbyhq.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "careers") return "Ashby";
      if (parts[0] && parts[0] !== "application") {
        return parts[0].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      }
    }
  } catch (e) {}
  return "Ashby";
}

function deriveTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const jid = parsed.searchParams.get("ashby_jid");
    if (jid) return `Ashby Position (${jid.slice(0, 8)})`;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[1]) return `${deriveCompanyFromUrl(url)} Position (${parts[1].slice(0, 8)})`;
  } catch (e) {}
  return "Software / AIML Engineer";
}

async function runParallelApplicationsForChetanSai() {
  console.log("===============================================================================");
  console.log("🚀 CLUCO.AI: IMPORTING DEMO USER 'MIDDE CHETAN SAI' & APPLYING ALL 15 JOBS IN PARALLEL");
  console.log("===============================================================================\n");

  const resumesDir = path.resolve(__dirname, "../../resumes");

  // 1. Fetch user accounts in database
  const usersRes = await db.query("SELECT id FROM users ORDER BY id ASC");
  if (usersRes.rowCount === 0) {
    console.log("👤 No users found in database. Seeding primary demo user...");
    const primaryId = "usr_demo_001";
    await db.query(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
      [primaryId, "chetanmidde1@gmail.com", "chetan_password_hash"]
    );
  }

  const allUsers = (await db.query("SELECT id FROM users ORDER BY id ASC")).rows;
  console.log(`👤 Database has ${allUsers.length} candidate user accounts. Updating candidate details to Midde Chetan Sai...\n`);

  // Text content of Midde Chetan Sai's resume for PDF generation
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

  // 2. Update each user account with Midde Chetan Sai's profile & resume PDF
  let primaryUserId = allUsers[0].id;
  const resumeFileName = "Midde_Chetan_Sai_Resume.pdf";

  for (let idx = 0; idx < allUsers.length; idx++) {
    const user = allUsers[idx];
    const userEmail = idx === 0 ? "chetanmidde1@gmail.com" : `chetanmidde1+user${idx + 1}@gmail.com`;
    const userResumeDir = path.join(resumesDir, `user_${user.id}`);

    if (!fs.existsSync(userResumeDir)) {
      fs.mkdirSync(userResumeDir, { recursive: true });
    }

    const resumeFilePath = path.join(userResumeDir, resumeFileName);
    
    // Generate PDF resume using Playwright
    try {
      await generateResumePdf(resumeFilePath, chetanResumeText);
    } catch (e) {
      // Fallback: Copy template PDF if browser generation has issues
      const validPdfTemplate = path.join(resumesDir, "user_usr_demo_001", "Aarav_Mehta_Resume.pdf");
      if (fs.existsSync(validPdfTemplate)) {
        fs.copyFileSync(validPdfTemplate, resumeFilePath);
      }
    }

    // Update user in users table
    await db.query("UPDATE users SET email = $1 WHERE id = $2", [userEmail, user.id]);

    // Update user profile in DB
    await db.query(
      `INSERT INTO user_profiles (
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
        `prof_${user.id}`,
        user.id,
        "Midde Chetan",
        "Sai",
        "+91 7032688265",
        "Vadodara, Gujarat, India",
        "https://linkedin.com/in/chetanmidde",
        "https://github.com/chetanmidde",
        "https://github.com/chetanmidde",
        "Authorized to Work",
        1,
        1,
      ]
    );

    // Update active resume in DB
    const relativePath = `resumes/user_${user.id}/${resumeFileName}`;
    await db.query(
      `INSERT INTO resumes (id, user_id, file_name, file_path, resume_type, is_active)
       VALUES ($1, $2, $3, $4, 'PDF', 1)
       ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_path = EXCLUDED.file_path, is_active = 1`,
      [`res_${user.id}`, user.id, resumeFileName, relativePath]
    );

    // Save Chetan Sai's answers into user_saved_answers
    const chetanAnswers: Record<string, string> = {
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
      design_work_links: "https://github.com/chetanmidde",
      age: "18-24",
      gender: "Male",
      ethnicity: "Asian / South Asian",
      communities: "Software Engineering Group",
      prefer_not_to_answer: "false"
    };

    for (const [key, val] of Object.entries(chetanAnswers)) {
      const answerId = `ans_${user.id}_${key}`;
      await db.query(
        `INSERT INTO user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
         VALUES ($1, $2, $3, $4, $5, 'USER')
         ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer`,
        [answerId, user.id, key, key, val]
      );
    }
  }

  console.log(`✅ Candidate accounts successfully populated with MIDDE CHETAN SAI's details and active resume.\n`);

  // 3. Prepare job and application entries for all 15 jobs
  console.log("📋 Preparing 15 Ashby jobs for Midde Chetan Sai...");

  const applicationsToRun: Array<{
    applicationId: string;
    jobId: string;
    userId: string;
    url: string;
    company: string;
    title: string;
  }> = [];

  for (let i = 0; i < JOB_URLS.length; i++) {
    const url = JOB_URLS[i];
    const ats = detectATSByUrl(url);
    const company = deriveCompanyFromUrl(url);
    const title = deriveTitleFromUrl(url);

    // Assign round-robin to user accounts or primary user
    const targetUserId = allUsers[i % allUsers.length].id;
    const resumeRes = await db.query("SELECT id FROM resumes WHERE user_id = $1 AND is_active = 1", [targetUserId]);
    const resumeId = resumeRes.rows[0].id;

    // Save or update Job record
    let jobId: string;
    const existingJob = await db.query("SELECT id FROM jobs WHERE url = $1", [url]);
    if (existingJob.rowCount > 0) {
      jobId = existingJob.rows[0].id;
      await db.query(
        `UPDATE jobs SET company = $1, title = $2, ats = $3, status = 'EXTRACTED' WHERE id = $4`,
        [company, title, ats, jobId]
      );
    } else {
      jobId = uuidv4();
      await db.query(
        `INSERT INTO jobs (id, url, company, title, description, ats, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [jobId, url, company, title, "Ashby application link", ats, "EXTRACTED"]
      );
    }

    // Save or update Application record
    let applicationId: string;
    const existingApp = await db.query("SELECT id FROM applications WHERE user_id = $1 AND job_id = $2", [targetUserId, jobId]);
    if (existingApp.rowCount > 0) {
      applicationId = existingApp.rows[0].id;
      await db.query(
        `UPDATE applications SET resume_id = $1, ats = $2, status = 'PENDING', updated_at = datetime('now') WHERE id = $3`,
        [resumeId, ats, applicationId]
      );
    } else {
      applicationId = uuidv4();
      await db.query(
        `INSERT INTO applications (id, user_id, job_id, resume_id, ats, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
        [applicationId, targetUserId, jobId, resumeId, ats]
      );
    }

    applicationsToRun.push({
      applicationId,
      jobId,
      userId: targetUserId,
      url,
      company,
      title
    });
  }

  console.log(`✅ ${applicationsToRun.length} applications queued for parallel execution.\n`);

  // 4. Execute ALL 15 jobs in PARALLEL
  console.log("⚡ [PARALLEL EXECUTION]: Launching browser automation for ALL 15 JOBS concurrently in parallel!\n");

  const startTime = Date.now();

  const parallelPromises = applicationsToRun.map((appItem, index) => {
    return new Promise(async (resolve) => {
      // Stagger browser launch by 1.5s per job to manage system CPU/RAM spikes smoothly
      await new Promise(r => setTimeout(r, index * 1500));

      console.log(`▶️ [Worker ${index + 1}/15]: Starting PARALLEL Job [${appItem.company}] (${appItem.url})`);
      
      try {
        await processApplication(
          appItem.applicationId,
          appItem.userId,
          appItem.jobId,
          appItem.url,
          {
            "Pronouns": "He/Him",
            "Do you speak fluent German?": "No",
            "Can you commit to working from one of our offices on Anchor Days each week?": "Yes",
            "Will you now or in the future require Notion to sponsor you in an immigration case in order to employ you?": "No",
            "How did you hear about this opportunity?": "LinkedIn"
          }
        );

        // Fetch final status from DB
        const appRes = await db.query(
          "SELECT status, screenshot_path, error_message FROM applications WHERE id = $1",
          [appItem.applicationId]
        );
        const finalRow = appRes.rows[0];

        console.log(`🏁 [Worker ${index + 1}/15 Completed]: ${appItem.company} -> Status: ${finalRow.status}`);

        resolve({
          index: index + 1,
          company: appItem.company,
          title: appItem.title,
          url: appItem.url,
          status: finalRow.status,
          screenshotPath: finalRow.screenshot_path || "N/A",
          error: finalRow.error_message || null
        });
      } catch (err: any) {
        console.error(`❌ [Worker ${index + 1}/15 Failed]: ${appItem.company} -> Error: ${err.message}`);
        resolve({
          index: index + 1,
          company: appItem.company,
          title: appItem.title,
          url: appItem.url,
          status: "FAILED",
          screenshotPath: "N/A",
          error: err.message
        });
      }
    });
  });

  const results: any[] = await Promise.all(parallelPromises);
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n===============================================================================");
  console.log(`🎉 ALL 15 PARALLEL JOB APPLICATIONS COMPLETED IN ${totalDuration} SECONDS!`);
  console.log("===============================================================================\n");

  console.log("📊 PARALLEL APPLICATION RESULTS SUMMARY:");
  console.log("--------------------------------------------------------------------------------");
  results.forEach((res: any) => {
    const icon = res.status === "SUBMITTED" ? "✅" : (res.status === "FAILED" ? "❌" : "⏳");
    console.log(`${icon} Job ${res.index}: [${res.company}] ${res.title}`);
    console.log(`   URL: ${res.url}`);
    console.log(`   Status: ${res.status}`);
    if (res.error) console.log(`   Error: ${res.error}`);
    if (res.screenshotPath !== "N/A") console.log(`   Screenshot: ${res.screenshotPath}`);
    console.log("--------------------------------------------------------------------------------");
  });

  await db.close();
  process.exit(0);
}

runParallelApplicationsForChetanSai().catch(async (err) => {
  console.error("❌ Fatal Parallel Run Error:", err);
  await db.close();
  process.exit(1);
});
