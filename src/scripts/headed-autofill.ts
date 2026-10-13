import { db } from "../database/db";
import { chromium } from "playwright";
import { applyStealthScripts, createBrowser, createPersistentBrowserContext, DEFAULT_USER_AGENT } from "../browser/browser-manager";
import { detectAndGetAdapter } from "../ats/ats-factory";
import { UserProfile, WorkExperienceItem, EducationItem } from "../ats/ats.interface";
import { resolveLocalResumePath } from "../utils/path-resolver";
import { handleCloudflareTurnstile } from "../browser/turnstile-handler";

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║             ⚡ CLUCO.AI AUTO-PILOT : MULTI-USER JOB AUTOFILL           ║
║      Automated Multi-User ATS Job Application Filling & Submission      ║
╚════════════════════════════════════════════════════════════════════════╝
`);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const isForceAllAutoSubmit = args.includes("--force-auto-submit-all") || args.includes("--auto-submit-all");
  const isManualOnly = args.includes("--manual") || args.includes("--no-auto-submit");
  const isParallelAllMode = args.includes("--parallel");
  const isSequentialMode = !isParallelAllMode; // Default to safe sequential execution to prevent anti-bot spam flags
  const isKeepOpenMode = !args.includes("--close"); // Default to keeping tabs open on screen

  console.log(`⚙️  Auto-Submit Policy: 🟢 AUTO-SUBMIT FOR LEVER & WORKABLE JOBS | 🟡 MANUAL REVIEW FOR ALL OTHER ATS PLATFORMS`);
  console.log(`⚙️  Execution: ${isParallelAllMode ? "⚡ SIMULTANEOUS PARALLEL (All tabs open at once)" : "🎯 Sequential"}`);
  console.log(`⚙️  Window Control: ${isKeepOpenMode ? "📌 Keep Windows Open" : "🔒 Auto-close tabs on finish"}\n`);

  // 1. Fetch all user profiles from DB and deduplicate by full name
  const profilesRes = await db.query(
    "SELECT u.email, p.* FROM user_profiles p JOIN users u ON p.user_id = u.id ORDER BY p.user_id ASC"
  );
  
  if (profilesRes.rowCount === 0) {
    console.error("❌ No users found in database. Run database seed first!");
    process.exit(1);
  }

  // Deduplicate by name so each job gets a distinct person (Aarav, Rohan, Ananya, Vikram, Neha, Arjun, Priya, Karan, Sneha, Aditya, Kavya, Rahul, Divya, Siddharth, Meera)
  const seenNames = new Set<string>();
  const allProfiles = profilesRes.rows.filter((p: any) => {
    const nameKey = `${p.first_name}_${p.last_name}`.toLowerCase();
    if (seenNames.has(nameKey)) return false;
    seenNames.add(nameKey);
    return true;
  });

  // Check if a specific user candidate is requested via --user flag (e.g. --user 2, --user sandeep, --user 1, --user chetan)
  const userArgIdx = args.indexOf("--user");
  const isRotateMode = args.includes("--rotate");
  let selectedUser: any = null;

  if (userArgIdx !== -1 && args[userArgIdx + 1]) {
    const uVal = args[userArgIdx + 1].toLowerCase();
    if (uVal.includes("hrutin") || uVal.includes("nammi")) {
      selectedUser = allProfiles.find(p => p.email.includes("hrutin") || p.first_name.toLowerCase().includes("hrutin")) || allProfiles[0];
    } else if (uVal === "2" || uVal.includes("sandeep") || uVal.includes("yalla")) {
      selectedUser = allProfiles.find(p => p.email.includes("sandeep") || p.first_name.toLowerCase().includes("sandeep")) || allProfiles[1] || allProfiles[0];
    } else if (uVal === "1" || uVal.includes("chetan") || uVal.includes("midde")) {
      selectedUser = allProfiles.find(p => p.email.includes("chetan") || p.first_name.toLowerCase().includes("chetan")) || allProfiles[0];
    } else {
      const idxNum = parseInt(uVal, 10);
      if (!isNaN(idxNum) && idxNum > 0 && idxNum <= allProfiles.length) {
        selectedUser = allProfiles[idxNum - 1];
      }
    }
  } else if (!isRotateMode) {
    // DEFAULT TO HRUTIN NAMMI FOR ALL JOBS
    selectedUser = allProfiles.find(p => p.email.includes("hrutin") || p.first_name.toLowerCase().includes("hrutin")) || allProfiles[0];
  }

  // Pre-fetch resumes map upfront to avoid querying DB during browser runs
  const resumesRes = await db.query("SELECT user_id, file_path FROM resumes WHERE is_active = 1").catch(() => ({ rows: [] }));
  const resumeMap = new Map<string, string>();
  for (const row of (resumesRes.rows || [])) {
    resumeMap.set(row.user_id, row.file_path);
  }

  // Determine URLs to process
  let urls: string[] = [];
  const urlArgs = args.filter(arg => arg.startsWith("http://") || arg.startsWith("https://"));
  const isSmartRecruitersOnly = args.includes("--sr-only") || args.includes("--smartrecruiters-only");
  const isWorkableOnly =
    args.includes("--workable") ||
    args.includes("--workable-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "workable") ||
    process.env.WORKABLE_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "WORKABLE";
  const isWorkdayOnly =
    args.includes("--workday") ||
    args.includes("--workday-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "workday") ||
    process.env.WORKDAY_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "WORKDAY";
  const isGreenhouseOnly = args.includes("--greenhouse") || args.includes("--ats-greenhouse") || (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "greenhouse");
  const isAshbyOnly = args.includes("--ashby") || (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "ashby");
  const isLeverOnly = args.includes("--lever") || args.includes("--lever-only") || (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase()?.includes("lever"));
  const isOracleOnly =
    args.includes("--oracle") ||
    args.includes("--oracle-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "oracle") ||
    process.env.ORACLE_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "ORACLE";
  const isAll = args.includes("--all");
  
  if (urlArgs.length > 0) {
    urls = urlArgs;
  } else if (isOracleOnly) {
    console.log("🎯 Filtering queued jobs strictly for ORACLE ATS (4 requested jobs)...");
    urls = [
      "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer",
      "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344708/?keyword=software+engineer&mode=location",
      "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/345236/?keyword=software+engineer",
      "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/338844/?keyword=software+engineers"
    ];
  } else if (isWorkableOnly) {
    console.log("🎯 Filtering queued jobs strictly for WORKABLE ATS only...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'WORKABLE' OR url LIKE '%workable.com%') ORDER BY url ASC");
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
    if (urls.length === 0) {
      urls = [
        "https://apply.workable.com/rokt/j/7219AFDA7F/apply/",
        "https://apply.workable.com/rokt/j/8C792C8AC9/apply/",
        "https://apply.workable.com/rokt/j/33E0F9B588/apply/"
      ];
    }
  } else if (isLeverOnly) {
    console.log("🎯 Filtering queued jobs strictly for LEVER ATS only...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'LEVER' OR url LIKE '%lever.co%') ORDER BY url ASC");
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
    if (urls.length === 0) {
      urls = [
        "https://jobs.lever.co/sonatype/dc2c0041-d681-4b0b-b113-b99984af95f4/apply",
        "https://jobs.lever.co/moonpay/6e864b20-6e5b-4918-b0b5-a7ec5a3e65ca/apply"
      ];
    }
  } else if (isWorkdayOnly) {
    console.log("🎯 Filtering queued jobs strictly for WORKDAY ATS only...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'WORKDAY' OR url LIKE '%myworkdayjobs.com%') ORDER BY url ASC");
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
    if (urls.length === 0) {
      urls = [
        "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/job/United-States-Remote/Imaging-Research-Associate-I_R18293",
        "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Mulgrave/Software-Engineer_R-2026-50218-1"
      ];
    }
  } else if (isGreenhouseOnly) {
    console.log("🎯 Filtering queued jobs strictly for GREENHOUSE ATS only...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'GREENHOUSE' OR url LIKE '%greenhouse.io%') ORDER BY url ASC");
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
  } else if (isAshbyOnly) {
    console.log("🎯 Filtering queued jobs strictly for ASHBY ATS only...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'ASHBY' OR url LIKE '%ashbyhq.com%') AND url != 'https://ashbyhq.com/test-job' ORDER BY url ASC");
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
  } else if (isSmartRecruitersOnly) {
    console.log("🎯 Filtering queued jobs strictly for SMARTRECRUITERS ATS only...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'SMARTRECRUITERS' OR url LIKE '%smartrecruiters.com%') ORDER BY url ASC");
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
  } else if (isAll) {
    // Fetch all unique real application URLs from jobs table (exclude test job)
    console.log("🎯 Processing ALL queued jobs from database...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE url != 'https://ashbyhq.com/test-job' ORDER BY url ASC");
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
  } else {
    // Default: Run SMARTRECRUITERS jobs (4) -> LEVER jobs (2) -> WORKDAY jobs (2)
    console.log("🎯 Queueing all active jobs: SMARTRECRUITERS (4) -> LEVER (2) -> WORKDAY (2)...");
    const srRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'SMARTRECRUITERS' OR url LIKE '%smartrecruiters.com%') AND url NOT LIKE '%screening%' ORDER BY url ASC");
    const leverRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'LEVER' OR url LIKE '%lever.co%') ORDER BY url ASC");
    const wdRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'WORKDAY' OR url LIKE '%myworkdayjobs.com%') ORDER BY url ASC");
    const srUrls = Array.from(new Set(srRes.rows.map((row: any) => row.url)));
    const leverUrls = Array.from(new Set(leverRes.rows.map((row: any) => row.url)));
    const wdUrls = Array.from(new Set(wdRes.rows.map((row: any) => row.url)));
    urls = [...srUrls, ...leverUrls, ...wdUrls];
    if (urls.length === 0) {
      urls = [
        "https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3",
        "https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/83647ca1-c14d-4d2e-bf5a-e190e6416a26?dcr_ci=ServiceNow",
        "https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow",
        "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/cc5c9e54-2843-4201-9096-e222015570a7?dcr_ci=Socotec",
        "https://jobs.lever.co/moonpay/6e864b20-6e5b-4918-b0b5-a7ec5a3e65ca/apply",
        "https://jobs.lever.co/sonatype/dc2c0041-d681-4b0b-b113-b99984af95f4/apply",
        "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/job/United-States-Remote/Imaging-Research-Associate-I_R18293",
        "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Mulgrave/Software-Engineer_R-2026-50218-1"
      ];
    }
  }

  // Check if limit argument is provided
  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    const limit = parseInt(args[limitIdx + 1], 10);
    if (!isNaN(limit) && limit > 0) {
      urls = urls.slice(0, limit);
    }
  }

  if (urls.length === 0) {
    console.log("⚠️ No job application URLs found in database to autofill.");
    await db.close();
    return;
  }

  if (selectedUser) {
    console.log(`🎯 CANDIDATE SELECTION: All ${urls.length} job(s) will be applied strictly using:`);
    console.log(`   👉 ${selectedUser.first_name} ${selectedUser.last_name} (${selectedUser.email})\n`);
  } else {
    console.log(`👥 MULTI-USER ROTATION ACTIVE: Rotating candidates per job (Use --user 2 for Sandeep only or --user 1 for Chetan only)\n`);
  }

  console.log(`📋 Found ${urls.length} job(s) queued for autofill.\n`);

  // Launch Chrome context (Persistent Chrome Profile for Lever & Workable to preserve Cloudflare / hCaptcha clearance & cookies)
  const isPersistentContext = isLeverOnly || isWorkableOnly || urls.some(u => u.includes("lever.co") || u.includes("workable.com"));
  let browser: any = null;
  let persistentContext: any = null;
  let sharedContext: any = null;

  if (isPersistentContext) {
    console.log("🛡️ [Anti-Bot Engine]: Initializing Persistent Chrome Session to preserve Cloudflare / hCaptcha clearance & cookies...");
    persistentContext = await createPersistentBrowserContext(false);
  } else {
    browser = await createBrowser(false);
    sharedContext = await browser.newContext({
      userAgent: DEFAULT_USER_AGENT,
      viewport: { width: 1280, height: 850 },
      deviceScaleFactor: 1,
      locale: "en-US",
    });
    await applyStealthScripts(sharedContext);
  }

  const processJob = async (url: string, index: number, total: number) => {
    // Pick designated user profile or rotate if --rotate passed
    const dbProfile = selectedUser || allProfiles[index % allProfiles.length];
    
    // Support custom email via CLI flag --email <email> or subaddressing
    const emailArgIdx = args.indexOf("--email");
    let email = (emailArgIdx !== -1 && args[emailArgIdx + 1]) ? args[emailArgIdx + 1] : dbProfile.email;
    if (args.includes("--subaddress") && email && email.includes("@")) {
      const [localPart, domainPart] = email.split("@");
      const baseLocal = localPart.split("+")[0];
      email = `${baseLocal}+1@${domainPart}`;
    }

    // Parse location parts into street, city, state, zipCode, country
    const isOracle = isOracleOnly || args.includes("--oracle") || process.env.ATS_FILTER?.toUpperCase() === "ORACLE";
    const isHrutin = (dbProfile.first_name || "").toLowerCase().includes("hrutin") || (email || "").includes("hrutin") || (email || "").includes("babufakemail");
    const street = isOracle ? "500 Oracle Parkway" : (isHrutin ? "1/908 aaradhya" : ((dbProfile.location || "").split(",")[0]?.trim() || "1/908 aaradhya"));
    const addressLine2 = isOracle ? "Suite 100" : "limda , wagodhiya";
    const city = isOracle ? "Redwood City" : "Vadodara";
    const state = isOracle ? "California" : "Gujarat";
    const zipCode = isOracle ? "94065" : "390144";
    const country = isOracle ? "United States" : "India";
    const phone = isOracle ? "4155552671" : (dbProfile.phone || "8688423267");
    const location = isOracle ? "Redwood City, California, United States" : dbProfile.location;
    const experiences: WorkExperienceItem[] = [
      {
        jobTitle: "Full Stack AI Developer",
        company: "Jobspring",
        location: isOracle ? "Redwood City, California, United States" : "Vadodara, Gujarat, India",
        currentlyWorkHere: true,
        startDate: "01/2024",
        startMonth: "01",
        startYear: "2024",
        endDate: "01/2026",
        endMonth: "01",
        endYear: "2026",
        description: "Built an AI-powered resume generation platform using OpenAI APIs, generating 50+ customized resumes for users. Designed and implemented scalable FastAPI backend services and React frontend workflows for multi-user applications. Reduced API response latency by 30% through database query optimization and backend performance improvements. Containerized and deployed applications using Docker and Azure App Service, reducing deployment time by 60%."
      },
      {
        jobTitle: "Full Stack Developer",
        company: "Nomadic Trails",
        location: "Remote",
        currentlyWorkHere: false,
        startDate: "09/2024",
        startMonth: "09",
        startYear: "2024",
        endDate: "10/2025",
        endMonth: "10",
        endYear: "2025",
        description: "Delivered full-stack features for a travel-tech platform serving customer-facing applications. Built scalable backend APIs and responsive frontend interfaces using modern development practices. Integrated third-party APIs for itinerary generation and workflow automation."
      }
    ];

    const educations: EducationItem[] = [
      {
        school: "Parul University",
        degree: "Bachelor of Technology",
        fieldOfStudy: "Computer Science and Engineering",
        gpa: "7.1",
        startDate: "08/2023",
        startYear: "2023",
        endDate: "06/2027",
        endYear: "2027"
      }
    ];

    const skills = [
      "Python", "FastAPI", "React", "JavaScript", "Docker", "REST APIs", "MySQL", "MongoDB", "Git", "Azure", "NLP", "RAG"
    ];

    const profile: UserProfile = {
      userId: dbProfile.user_id,
      firstName: dbProfile.first_name,
      lastName: dbProfile.last_name,
      email: email,
      phone: phone,
      location: location,
      street: street,
      addressLine2: addressLine2,
      city: city,
      state: state,
      zipCode: zipCode,
      country: country,
      linkedinUrl: dbProfile.linkedin_url || "https://linkedin.com/in/hrutinnammi",
      githubUrl: dbProfile.github_url || "https://github.com/hrutinnammi",
      portfolioUrl: dbProfile.portfolio_url || "https://github.com/hrutinnammi",
      workAuthorization: dbProfile.work_authorization,
      willingToRelocate: dbProfile.willing_to_relocate === 1,
      yearsOfExperience: dbProfile.years_of_experience || 2,
      gender: dbProfile.gender || "Male",
      experiences: experiences,
      educations: educations,
      skills: skills,
      websites: [
        dbProfile.linkedin_url || "https://linkedin.com/in/hrutinnammi",
        dbProfile.github_url || "https://github.com/hrutinnammi"
      ]
    };

    const rawResumePath = dbProfile.resume_path || resumeMap.get(dbProfile.user_id) || `resumes/user_${dbProfile.user_id}/resume.pdf`;
    const resumePath = resolveLocalResumePath(rawResumePath);
    profile.resumePath = resumePath;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🚀 [Job ${index + 1}/${total}] URL: ${url}`);
    console.log(`👤 Assigned User: ${profile.firstName} ${profile.lastName} (${profile.email})`);
    console.log(`📍 Location: ${profile.location} | Relocate: ${profile.willingToRelocate ? "Yes" : "No"}`);
    console.log(`📄 Resume: ${resumePath}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const context = persistentContext || sharedContext;
    const page = await context.newPage();
    let jobHasError = false;

    const additionalAnswers: Record<string, string> = {
      resumePath: resumePath,
      "How did you hear about this opportunity?": "LinkedIn",
      "Notice Period": "Immediate",
      "Current Notice Period": "Immediate",
      "What is your current notice period?": "Immediate",
      "Expected Salary": "Negotiable",
      "Desired Salary": "Negotiable",
      "Current Salary": "Negotiable",
      "What is your current gross monthly salary?": "Negotiable",
      "What are gross monthly salary expectations?": "Negotiable",
      "English language skills": "Professional Working Proficiency / Fluent",
      "How would you describe your English language skills?": "Fluent / Professional Working Proficiency",
      "English": "Fluent",
      "Referral": "Tarun Komati",
      "Reference": "Tarun Komati",
      "Who referred you": "Tarun Komati",
      "Referred By": "Tarun Komati"
    };

    try {
      // If Lever URL without /apply, append /apply to go directly to the application form
      let targetUrl = url;
      if (targetUrl.includes("lever.co") && !targetUrl.includes("/apply")) {
        targetUrl = targetUrl.replace(/\/?$/, "/apply");
      }

      console.log(`🌐 Navigating to application page: ${targetUrl}...`);
      await page.goto(targetUrl, { waitUntil: "load", timeout: 60000 });
      
      // Auto-detect & resolve Cloudflare Turnstile if intercepted
      await handleCloudflareTurnstile(page);

      await page.waitForSelector(
        "input:not([type='hidden']), textarea, select, [data-field-path], button:has-text('Apply')",
        { timeout: 12000 }
      ).catch(() => console.warn(`⚠️ Form selector initial wait timed out. Proceeding.`));
      
      const { ats, adapter } = await detectAndGetAdapter(page, targetUrl);
      console.log(`🎯 Detected ATS Platform: ${ats}`);

      // Auto-submit policy: Auto-submit for LEVER and WORKABLE jobs (unless manual only)
      const isLeverJob = ats === "LEVER" || targetUrl.toLowerCase().includes("lever.co");
      const isWorkableJob = ats === "WORKABLE" || targetUrl.toLowerCase().includes("workable.com");
      const shouldAutoSubmitThisJob = (isLeverJob || isWorkableJob || isForceAllAutoSubmit) && !isManualOnly;

      if (shouldAutoSubmitThisJob) {
        process.env.AUTO_SUBMIT = "true";
        process.env.DRY_RUN = "false";
        console.log(`⚡ [Policy]: ${ats} detected -> AUTO-SUBMIT IS ACTIVE FOR THIS JOB 🚀`);
      } else {
        process.env.AUTO_SUBMIT = "false";
        process.env.DRY_RUN = "true";
        console.log(`🔒 [Policy]: ${ats} detected -> AUTO-SUBMIT DISABLED (Manual review mode only) 🎯`);
      }
      
      // Extract fields & detect job details
      console.log(`🔍 Scanning form structure and extracting logical fields...`);
      const fields = await adapter.extractFields(page);
      console.log(`📊 Extracted ${fields.length} interactive form fields.`);
      
      // Fill form fields with user specific profile & DB saved answers in parallel with human mouse
      console.log(`✍️ Automatically filling form with ${profile.firstName} ${profile.lastName}'s details & smart answers...`);
      await adapter.fillForm(page, profile, additionalAnswers, fields);

      // Upload user resume
      console.log(`📂 Uploading ${profile.firstName}'s resume: ${resumePath}...`);
      await (adapter as any).uploadResume(page, resumePath, fields, profile);
      
      // Wait for parser if present
      await page.waitForSelector(
        "[data-upload-state='complete'], [class*='uploadComplete'], [class*='upload-complete']",
        { timeout: 8000 }
      ).catch(() => {});
      
      // Validate all required inputs
      console.log(`🔍 Validating required form inputs...`);
      const isValid = await adapter.validate(page, fields);
      if (!isValid) {
        console.warn(`⚠️ Validation check reported some fields may be incomplete.`);
      } else {
        console.log(`✅ All required fields verified successfully for ${profile.firstName} ${profile.lastName}.`);
      }

      // Submit / Prepare application
      if (shouldAutoSubmitThisJob) {
        console.log(`🚀 Executing automatic application submission for ${profile.firstName} (${ats} Auto-Submit)...`);
        const submitResult = await adapter.submit(page);
        
        await db.query(
          `UPDATE applications SET status = $1, submitted_at = CURRENT_TIMESTAMP 
           WHERE user_id = $2 AND job_id IN (SELECT id FROM jobs WHERE url = $3)`,
          [submitResult.success ? "SUBMITTED" : "FAILED", profile.userId, url]
        ).catch(() => {});

        console.log(`\n📋 [Job ${index + 1}/${total}] Result Summary:`);
        console.log(`   - Candidate Applied: ${profile.firstName} ${profile.lastName} (${profile.email})`);
        console.log(`   - ATS Platform: ${ats}`);
        console.log(`   - Submission Status: ${submitResult.success ? "✅ AUTO-SUBMITTED" : "❌ FAILED"}`);
        if (submitResult.confirmation) console.log(`   - Confirmation: ${submitResult.confirmation}`);
        if (submitResult.errorMessage) console.log(`   - Error / Notice: ${submitResult.errorMessage}`);
      } else {
        console.log(`🎯 Form autofilled & verified for ${profile.firstName}. Ready for your manual submit click! (${ats} auto-submit disabled)`);
        const submitResult = await adapter.submit(page);

        await db.query(
          `UPDATE applications SET status = 'READY_TO_SUBMIT', updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = $1 AND job_id IN (SELECT id FROM jobs WHERE url = $2)`,
          [profile.userId, url]
        ).catch(() => {});

        console.log(`\n📋 [Job ${index + 1}/${total}] Result Summary:`);
        console.log(`   - Candidate Applied: ${profile.firstName} ${profile.lastName} (${profile.email})`);
        console.log(`   - ATS Platform: ${ats}`);
        console.log(`   - Submission Status: 🟢 READY FOR MANUAL SUBMIT (Auto-submit disabled for ${ats})`);
        console.log(`   👉 Tab is centered on submit button for your manual review and click!`);
      }
      
      console.log(`\n✅ Completed application for ${profile.firstName} ${profile.lastName} (Job ${index + 1}/${total}).`);
    } catch (error: any) {
      jobHasError = true;
      if (error.message.includes("Target page, context or browser has been closed") || error.message.includes("closed")) {
        console.log(`ℹ️ [Job ${index + 1}] Browser closed by user.`);
      } else {
        console.error(`❌ [Job ${index + 1}] Error during autofill for ${profile.firstName}:`, error.message);
      }
    } finally {
      if (!isKeepOpenMode && !jobHasError) {
        await page.close().catch(() => {});
        console.log(`🔒 Closed tab for Job ${index + 1}/${total}.\n`);
      } else {
        console.log(`📌 Keeping tab open for Job ${index + 1}/${total}.\n`);
      }
    }
  };

  if (isSequentialMode) {
    console.log(`🎯 Processing ${urls.length} job(s) sequentially with multi-user profile rotation...`);
    for (let i = 0; i < urls.length; i++) {
      await processJob(urls[i], i, urls.length);
      if (i < urls.length - 1) {
        const pauseMs = 6000 + Math.floor(Math.random() * 2000);
        console.log(`⏳ Pausing ${Math.round(pauseMs / 1000)}s between applications to satisfy rate-limiting & anti-spam checks...\n`);
        await new Promise(r => setTimeout(r, pauseMs));
      }
    }
  } else {
    console.log(`⚡ Opening all ${urls.length} job application(s) at once and filling SIMULTANEOUSLY in parallel...`);
    const promises = urls.map((url, i) => processJob(url, i, urls.length));
    await Promise.all(promises);
  }

  if (!isKeepOpenMode) {
    if (persistentContext) await persistentContext.close().catch(() => {});
    if (sharedContext) await sharedContext.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  } else {
    console.log(`📌 Keeping all ${urls.length} browser tabs open on screen for your review!`);
  }
  console.log(`🎉 All ${urls.length} job application(s) processed successfully!`);
  await db.close();
}

main().catch(async (err) => {
  console.error("❌ Fatal execution error:", err);
  await db.close();
  process.exit(1);
});
