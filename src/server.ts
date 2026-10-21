import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { config } from "./config";
import { db } from "./database/db";
import { withBrowserPage, generateResumePdf } from "./browser/browser-manager";
import { v4 as uuidv4 } from "uuid";
import { detectATSByPage, detectATSByUrl } from "./ats/ats-detector";
import { AshbyAdapter } from "./ats/ashby/ashby.adapter";
import { UserProfile } from "./ats/ats.interface";
import { applicationQueue } from "./scheduler/application-queue";
import { resolveLocalResumePath } from "./utils/path-resolver";

const app = express();
app.use(express.json());
app.use("/screenshots", express.static(config.screenshotsDir));

// Ensure required directories exist
if (!fs.existsSync(config.resumesDir)) {
  fs.mkdirSync(config.resumesDir, { recursive: true });
}
if (!fs.existsSync(config.screenshotsDir)) {
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
}

// Health check
app.get("/health", async (req: Request, res: Response) => {
  try {
    // Check DB health
    const dbResult = await db.query("SELECT datetime('now') as now");
    res.json({
      status: "OK",
      environment: config.env,
      database: "CONNECTED",
      timestamp: dbResult.rows[0].now,
    });
  } catch (error: any) {
    res.status(500).json({
      status: "ERROR",
      environment: config.env,
      database: "DISCONNECTED",
      error: error.message,
    });
  }
});

// Phase 3 Screenshot test endpoint
app.post("/test-screenshot", async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: "Missing 'url' parameter in request body" });
    return;
  }

  try {
    console.log(`📸 Taking screenshot for URL: ${url}`);
    const result = await withBrowserPage(async (page) => {
      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: "load" });
      
      const title = await page.title();
      const resolvedUrl = page.url();
      console.log(`Page Loaded - Title: "${title}", Resolved URL: "${resolvedUrl}"`);

      // Ensure screenshot directory exists
      const filename = `job_${Date.now()}.png`;
      const screenshotPath = path.join(config.screenshotsDir, filename);
      
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });
      
      console.log(`Screenshot saved to ${screenshotPath}`);

      return {
        title,
        resolvedUrl,
        screenshotPath,
        filename,
      };
    }, { headless: true }); // Using headless true for background verification

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Screenshot test failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Seed API endpoint for easy development testing
app.post("/seed", async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("🌱 Seeding database with initial testing data...");
    
    // 1. Clear existing tables to ensure clean seed (SQLite compatible)
    await db.query("DELETE FROM application_events");
    await db.query("DELETE FROM application_answers");
    await db.query("DELETE FROM applications");
    await db.query("DELETE FROM jobs");
    await db.query("DELETE FROM resumes");
    await db.query("DELETE FROM user_profiles");
    await db.query("DELETE FROM users");

    // 2. Insert all test jobs (First in order)
    const testJobs = [
      {
        url: "https://jobs.ashbyhq.com/notion/05e14247-17c4-4e98-9a13-53828a4e2f13/application",
        company: "Notion",
        title: "Business Development Representative, New York",
        ats: "ASHBY"
      },
      {
        url: "https://jobs.ashbyhq.com/vanta/fe5fd1a4-12ff-4703-bed5-6c2f34ba7768/application",
        company: "Vanta",
        title: "Senior Account Executive, Growth Stage",
        ats: "ASHBY"
      },
      {
        url: "https://jobs.ashbyhq.com/veritycloud/infra-engineer/application",
        company: "Verity Cloud",
        title: "Infrastructure Engineer",
        ats: "ASHBY"
      },
      {
        url: "https://jobs.ashbyhq.com/veritycloud/infra-engineer",
        company: "Verity Cloud",
        title: "Infrastructure Engineer (Job Page)",
        ats: "ASHBY"
      },
      {
        url: "https://www.ashbyhq.com/careers?ashby_location_id=9c7cb4a1-489c-4550-a4ca-a667a981275c&ashby_jid=95aecf44-abba-4d06-8fea-7987b6ea9db5",
        company: "Ashby Job 1",
        title: "Position 1",
        ats: "ASHBY"
      },
      {
        url: "https://www.ashbyhq.com/careers?ashby_jid=033ce772-ed08-4a59-bb52-4ff0eaac9bcd",
        company: "Ashby Job 2",
        title: "Position 2",
        ats: "ASHBY"
      },
      {
        url: "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_jid=7a3ff629-6c67-4aa5-bea4-f1d88b3b4777",
        company: "Ashby Job 3",
        title: "Position 3",
        ats: "ASHBY"
      },
      {
        url: "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_jid=6a15668c-3f98-4404-8f1f-927cddfc5af7",
        company: "Ashby Job 4",
        title: "Position 4",
        ats: "ASHBY"
      },
      {
        url: "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_jid=cb45928e-c7c7-4163-84d0-a962755a3593",
        company: "Ashby Job 5",
        title: "Position 5",
        ats: "ASHBY"
      },
      {
        url: "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_department_id=2c32d70f-d7cb-4a06-bd87-048084e3eb10&ashby_jid=0020099f-9bb3-4da9-9808-4556564f5301",
        company: "Ashby Job 6",
        title: "Position 6",
        ats: "ASHBY"
      },
      {
        url: "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_department_id=2c32d70f-d7cb-4a06-bd87-048084e3eb10&ashby_jid=695b1ce6-c375-4fad-94ef-61b50a3fbd28",
        company: "Ashby Job 7",
        title: "Position 7",
        ats: "ASHBY"
      },
      {
        url: "https://ashbyhq.com/test-job",
        company: "Example Corp",
        title: "Software Engineer (Full-Stack)",
        ats: "ASHBY"
      }
    ];

    const seededJobIds: string[] = [];
    for (const job of testJobs) {
      const jobId = uuidv4();
      await db.query(
        `INSERT INTO jobs (id, url, company, title, description, ats, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          jobId,
          job.url,
          job.company,
          job.title,
          `${job.title} at ${job.company}`,
          job.ats,
          "PENDING"
        ]
      );
      seededJobIds.push(jobId);
    }

    // 3. Insert test user and details (Second in order)
    const userId = "bb5c54fd-79ee-41fd-917b-6553a09195d1";
    await db.query(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, $3)`,
      [userId, "nfake0069@gmail.com", "hashed_password_123"]
    );

    const profileId = uuidv4();
    await db.query(
      `INSERT INTO user_profiles (
         id, user_id, first_name, last_name, phone, location, 
         linkedin_url, github_url, portfolio_url, work_authorization, 
         willing_to_relocate, years_of_experience
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        profileId,
        userId,
        "Aarav",
        "Mehta",
        "+91 90000 00000",
        "Vadodara, India",
        "https://www.linkedin.com/in/aarav-mehta-demo",
        "https://github.com/aarav-mehta-demo",
        "https://aarav-mehta-demo.example.com/portfolio",
        "No", // Sponsorship required? No
        1, // Willing to relocate
        4, // Years of experience
      ]
    );

    const userResumeDir = path.join(config.resumesDir, `user_${userId}`);
    if (!fs.existsSync(userResumeDir)) {
      fs.mkdirSync(userResumeDir, { recursive: true });
    }
    const resumePath = path.join(userResumeDir, "Aarav_Mehta_Resume.pdf");
    await generateResumePdf(
      resumePath, 
      `AARAV MEHTA\n` +
      `+91 90000 00000 | nfake0069@gmail.com | linkedin: https://www.linkedin.com/in/aarav-mehta-demo\n` +
      `aarav-mehta-demo.example.com/portfolio | github: github.com/aarav-mehta-demo\n\n` +
      `B.Tech Computer Science\n` +
      `Skills: JavaScript, TypeScript, React, Node.js, SQL\n`
    );

    const resumeId = uuidv4();
    await db.query(
      `INSERT INTO resumes (id, user_id, file_name, file_path, resume_type, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [resumeId, userId, "Aarav_Mehta_Resume.pdf", resumePath, "software-engineer", 1]
    );

    // 4. Seed user_saved_answers table with all custom screening, engineering, and CS answers
    const savedAnswers = [
      // Diversity Survey
      { question: "age", answer: "Under 30" },
      { question: "what is your age", answer: "Under 30" },
      { question: "current age", answer: "Under 30" },
      { question: "gender", answer: "Male" },
      { question: "gender identity", answer: "Male" },
      { question: "what is your gender", answer: "Male" },
      { question: "what is your gender identity", answer: "Male" },
      { question: "ethnicity", answer: "Asian or Asian American" },
      { question: "race", answer: "Asian or Asian American" },
      { question: "which ethnicityies do you identify with please select all that apply", answer: "Asian or Asian American" },
      { question: "communities", answer: "None of the above" },
      { question: "which of the following communities do you belong to please select all that apply", answer: "None of the above" },

      // Product / Support Specialist questions
      { question: "have you been a b2b support specialist on a saas product", answer: "Yes" },
      { question: "in your current or most recent role how many cases do you solve on a daily or weekly basis", answer: "10–12 cases per day" },
      { question: "please select your preferred working hours", answer: "Tuesday through Saturday" },
      { question: "describe a significant operational improvement you led within your support organisation specifically outline what wasnt working what steps did you take to improve it how did you measure the result", answer: "In my previous support role, I noticed that similar customer issues were being investigated repeatedly because troubleshooting steps were scattered across internal notes. I reviewed the most common ticket categories, grouped recurring issues, and created a structured troubleshooting guide with clear escalation criteria. I also added ticket tags so we could identify recurring problems and track resolution patterns.\n\nWe measured the improvement through average resolution time, repeat tickets, and escalations. After the process was introduced, average resolution time decreased by approximately 25%, while repeat tickets for the targeted issues dropped by around 20%. The process continued to work as ticket volume increased because the documentation and tagging system gave new team members a consistent workflow." },
      { question: "tell us about a hiring mistake you made when building a team what did you learn and how did you change your approach afterward", answer: "Early in my experience building a small team, I placed too much weight on technical ability and not enough on communication and ownership. The person was technically strong but struggled with collaboration and communicating blockers, which affected the team's overall efficiency.\n\nI learned to evaluate candidates more holistically. Since then, I have used structured interviews that assess problem-solving, communication, ownership, adaptability, and collaboration alongside technical skills. I also use realistic scenarios rather than relying only on resume experience." },
      { question: "describe a global support process you adapted for a specific region you supported apac or otherwise", answer: "While supporting customers across different regions, I noticed that customers in APAC preferred more structured communication and clearer handoff times because of timezone differences. I adapted our process by adding timezone-aware escalation rules, clearer response expectations, and standardized handoff notes.\n\nThe tradeoff was adding a small amount of process overhead, but it reduced delays between shifts. After implementation, missed handoffs decreased by approximately 30% and customers received more consistent updates." },

      // Technical customer issue
      { question: "please walk us through a specific time where you needed to troubleshoot a customers unique technical issue around which no documentation existed thoroughly outline your process any tools you utilized the learnings you gained and anything you would do differently if faced with the same situation please be specific", answer: "A customer experienced an integration failure that wasn't covered in our existing documentation. I first reproduced the issue using the customer's configuration, then compared successful and unsuccessful requests by checking API responses, request payloads, timestamps, and application logs. I used browser developer tools, API testing tools, and internal logs to isolate the problem.\n\nI eventually identified an unexpected configuration combination that caused the integration to fail. I documented the reproduction steps, root cause, workaround, and permanent fix and shared the findings with the engineering team. The documentation was then added to our internal knowledge base.\n\nThe main lesson was that troubleshooting should be evidence-driven rather than based on assumptions. If I faced the same issue again, I would establish a minimal reproducible case earlier and capture the relevant logs before changing configuration." },

      // Enterprise Customer Success questions
      { question: "do you have at least 3 years of experience leading a customer success team in the enterprise space at a b2b saas company if so describe that experience including how you define enterprise and what differentiates enterprise from a down market team", answer: "Yes — 4 years of experience leading Customer Success teams supporting Enterprise B2B SaaS customers.\n\nI define Enterprise customers as organizations with complex deployments, multiple stakeholders, larger user bases, security or compliance requirements, and a longer decision-making process. Enterprise Customer Success requires more structured account planning, executive communication, stakeholder mapping, adoption monitoring, and proactive risk management than a down-market motion." },
      { question: "what made the products and customer environments you supported complex please share a specific example of a customer challenge your team helped solve and the outcome achieved", answer: "The environments were complex because customers often had multiple teams using the product, different permission structures, integrations with existing systems, and several stakeholders with different goals. In one case, a customer was experiencing low adoption after implementation. We mapped the customer journey, identified where users were dropping off, worked with their administrators to improve onboarding, and created targeted enablement sessions.\n\nWithin the following quarter, product adoption increased by approximately 35% and support requests related to onboarding decreased significantly." },
      { question: "provide an example of when one of your enterprise customers revealed a gap in your teams internal process or playbook how did you recognize it was a problem and what did you build to address it at scale", answer: "An Enterprise customer repeatedly needed clarification around implementation ownership because responsibilities between Support, Customer Success, and Engineering were unclear. I recognized this as a process problem rather than an isolated customer issue after seeing similar questions from other accounts.\n\nI created a standardized implementation and escalation playbook defining ownership, handoff requirements, response expectations, and escalation paths. This made the process repeatable across accounts and reduced internal handoff delays." },
      { question: "what excites you about the opportunity to join ashby at this stage of your career", answer: "I'm excited by the opportunity to work on a product where customer experience, technology, and operational excellence are closely connected. Ashby's focus on building thoughtful software for recruiting teams is especially interesting to me because it combines a complex product environment with a strong need for reliable customer support. I would enjoy contributing to a team that values ownership, learning, and continuously improving how customers experience the product." },

      // Engineering application questions
      { question: "do you have 4 years of experience as a fulltime engineer", answer: "Yes" },
      { question: "whats the largest number of engineers under your management hierarchy", answer: "5–10" },
      { question: "describe a role you were in or a project you led that brought out your absolute best work what setup or attributes of the roleproject enabled that", answer: "One of my strongest projects was leading the development of an AI-powered workflow automation platform. I worked across product design, frontend development, backend APIs, AI integration, and deployment. What enabled my best work was having clear ownership of the problem while still having the freedom to experiment with different approaches.\n\nI particularly enjoyed the combination of solving technical problems and improving the experience for the end user. Regular feedback, short development cycles, and direct ownership helped me iterate quickly and make better decisions." },

      // Choose ONLY ONE of the three engineering questions
      { question: "describe a choice you made when shipping a product or working on a technical challenge that didnt come from a product manager or an engineering managerlead how did you advocate for it and what impact did it have on your end users", answer: "While working on an automation workflow, I noticed that users were being asked to repeatedly enter information that the system already had access to. Instead of simply implementing the requested workflow, I proposed using previously available information to pre-fill those fields and only ask users for missing or uncertain data.\n\nI advocated for the change by demonstrating the additional steps users were taking and building a small prototype to compare both approaches. The team agreed to the change because it reduced unnecessary interaction without significantly increasing implementation complexity.\n\nThe result was a simpler workflow with fewer manual inputs and a better user experience. It also changed how we approached similar features afterward: we started looking for opportunities to reuse existing context before asking users for information again." },

      // Product / frontend / design questions
      { question: "have you written and maintained code that was actively used in a product at its highest how many endusers was your code specifically supporting", answer: "1000 or more users" },
      { question: "have you designed and implemented components in a design system used by others", answer: "Yes" },
      { question: "please share any links that show productsfeaturesbranding where you directed and executed the visual design", answer: "https://aarav-mehta-demo.example.com/portfolio\nhttps://github.com/aarav-mehta-demo" },

      // Location eligibility question
      { question: "are you living in the country where this role is based and eligible to work there", answer: "Yes" },
      { question: "which city and country do you intend to work from", answer: "San Francisco, United States" }
    ];

    for (const ans of savedAnswers) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
         VALUES ($1, $2, $3, $4, $5, 'USER')`,
        [id, userId, ans.question, ans.question, ans.answer]
      );
    }

    res.json({
      success: true,
      message: "Database seeded successfully with master Aarav Mehta profile!",
      data: {
        userId,
        profileId,
        resumeId,
        seededJobIds,
        resumePath,
      },
    });
  } catch (error: any) {
    console.error("❌ Seeding database failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Phase 5 Test Autofill endpoint
app.post("/applications/test-autofill", async (req: Request, res: Response): Promise<void> => {
  const { url, userId, additionalAnswers = {} } = req.body;
  if (!url || !userId) {
    res.status(400).json({ error: "Missing 'url' or 'userId' in request body" });
    return;
  }

  try {
    // 1. Fetch profile and resume
    const profileRes = await db.query(
      "SELECT u.email, p.* FROM user_profiles p JOIN users u ON p.user_id = u.id WHERE p.user_id = $1",
      [userId]
    );
    const resumeRes = await db.query(
      "SELECT * FROM resumes WHERE user_id = $1 AND is_active = 1",
      [userId]
    );

    if (profileRes.rowCount === 0) {
      res.status(404).json({ error: "User profile not found" });
      return;
    }
    if (resumeRes.rowCount === 0) {
      res.status(404).json({ error: "Active resume not found" });
      return;
    }

    const dbProfile = profileRes.rows[0];
    const profile: UserProfile = {
      userId: dbProfile.user_id,
      firstName: dbProfile.first_name,
      lastName: dbProfile.last_name,
      email: dbProfile.email,
      phone: dbProfile.phone,
      location: dbProfile.location,
      linkedinUrl: dbProfile.linkedin_url,
      githubUrl: dbProfile.github_url,
      portfolioUrl: dbProfile.portfolio_url,
      workAuthorization: dbProfile.work_authorization,
      willingToRelocate: dbProfile.willing_to_relocate === 1,
      yearsOfExperience: dbProfile.years_of_experience,
    };
    const resumePath = resolveLocalResumePath(resumeRes.rows[0].file_path);

    console.log(`🤖 Testing autofill on ${url} for user ${userId}`);

    // 2. Launch browser and run filling flow
    const result = await withBrowserPage(async (page) => {
      console.log(`Navigating to job page: ${url}`);
      // Bug 1 fix: use 'load' instead of 'networkidle'
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForSelector(
        "input:not([type='hidden']), textarea, select, [data-field-path], button:has-text('Apply')",
        { timeout: 10000 }
      ).catch(() => console.warn("[Autofill] Timed out waiting for form elements."));

      // Detect ATS
      const ats = await detectATSByPage(page);
      if (ats !== "ASHBY") {
        throw new Error(`ATS is ${ats}, not supported for autofill test yet. Ashby only.`);
      }

      const adapter = new AshbyAdapter();
      
      // Extract form fields before filling
      const originalFields = await adapter.extractFields(page);

      // Autofill profile fields with additional custom answers
      await adapter.fillForm(page, profile, additionalAnswers);

      // Upload resume
      await adapter.uploadResume(page, resumePath);

      // Validate inputs
      const isValid = await adapter.validate(page);

      // Capture screenshot
      const filename = `autofill_${Date.now()}.png`;
      const screenshotPath = path.join(config.screenshotsDir, filename);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      return {
        ats,
        isValid,
        originalFields,
        screenshotPath,
        filename,
      };
    }, { headless: true });

    res.json({
      success: true,
      message: "Autofill test completed (submission skipped).",
      ...result,
    });
  } catch (error: any) {
    console.error("Autofill test endpoint failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Phase 9 Queue Job Submission endpoint
app.post("/jobs", async (req: Request, res: Response): Promise<void> => {
  const { url, userId: inputUserId, additionalAnswers = {} } = req.body;
  if (!url) {
    res.status(400).json({ error: "Missing 'url' parameter in request body" });
    return;
  }

  try {
    // 1. Get user ID
    let userId = inputUserId;
    if (!userId) {
      const userRes = await db.query("SELECT id FROM users LIMIT 1");
      if (userRes.rowCount === 0) {
        res.status(400).json({ error: "No users exist in the database. Run /seed first." });
        return;
      }
      userId = userRes.rows[0].id;
    }

    // 2. Get active resume
    const resumeRes = await db.query("SELECT id FROM resumes WHERE user_id = $1 AND is_active = 1", [userId]);
    if (resumeRes.rowCount === 0) {
      res.status(400).json({ error: "No active resume found for this user. Seed first." });
      return;
    }
    const resumeId = resumeRes.rows[0].id;

    // 3. Detect ATS from URL
    const ats = detectATSByUrl(url);

    // 4. Save or get Job record
    let jobId: string;
    const existingJob = await db.query("SELECT id FROM jobs WHERE url = $1", [url]);
    if (existingJob.rowCount > 0) {
      jobId = existingJob.rows[0].id;
    } else {
      jobId = uuidv4();
      await db.query(
        `INSERT INTO jobs (id, url, company, title, description, ats, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [jobId, url, "Unknown Company", "Pending Extract", "Description pending extract...", ats, "PENDING"]
      );
    }

    // 5. Create application record
    const applicationId = uuidv4();
    await db.query(
      `INSERT INTO applications (id, user_id, job_id, resume_id, ats, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [applicationId, userId, jobId, resumeId, ats, "PENDING"]
    );

    // 6. Queue application for execution
    applicationQueue.add({
      applicationId,
      userId,
      jobId,
      url,
      additionalAnswers,
    });

    res.status(202).json({
      success: true,
      message: "Application queued successfully.",
      data: {
        applicationId,
        userId,
        jobId,
        ats,
      },
    });
  } catch (error: any) {
    console.error("Failed to enqueue job application:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Phase 9 Stats dashboard endpoint
app.get("/applications/stats", async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Today's applications
    const todayRes = await db.query(
      `SELECT COUNT(*) as count FROM applications 
       WHERE status = 'SUBMITTED' AND date(submitted_at) = date('now')`
    );
    const todayCount = todayRes.rows[0]?.count || 0;

    // 2. Status breakdown
    const breakdownRes = await db.query(
      "SELECT status, COUNT(*) as count FROM applications GROUP BY status"
    );
    const breakdown = breakdownRes.rows.reduce((acc: any, row: any) => {
      acc[row.status] = row.count;
      return acc;
    }, {});

    // 3. Queue stats
    const queueStats = applicationQueue.getStats();

    res.json({
      success: true,
      stats: {
        todaySubmittedCount: todayCount,
        dailyLimit: (process.env.DAILY_LIMIT && parseInt(process.env.DAILY_LIMIT)) || 20,
        breakdown: {
          PENDING: breakdown.PENDING || 0,
          PROCESSING: breakdown.PROCESSING || 0,
          SUBMITTED: breakdown.SUBMITTED || 0,
          FAILED: breakdown.FAILED || 0,
        },
        queue: queueStats,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Single application endpoint
app.get("/applications/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT a.*, j.company, j.title, j.url as job_url 
       FROM applications a 
       JOIN jobs j ON a.job_id = j.id 
       WHERE a.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ success: false, error: "Application not found" });
      return;
    }

    const row = result.rows[0];
    let screenshotUrl = null;
    if (row.screenshot_path) {
      screenshotUrl = `/screenshots/${path.basename(row.screenshot_path)}`;
    }

    res.json({
      success: true,
      data: {
        ...row,
        screenshotUrl,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Phase 9 Audit history endpoint
app.get("/applications/:id/history", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const eventsRes = await db.query(
      "SELECT * FROM application_events WHERE application_id = $1 ORDER BY created_at ASC",
      [id]
    );

    const events = eventsRes.rows.map((row: any) => {
      let parsedMeta = {};
      try {
        if (row.metadata) {
          parsedMeta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
        }
      } catch (e) {
        console.warn("Failed to parse event metadata:", row.metadata);
      }
      return {
        id: row.id,
        eventType: row.event_type,
        metadata: parsedMeta,
        createdAt: row.created_at,
      };
    });

    res.json({
      success: true,
      applicationId: id,
      eventCount: events.length,
      events,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(config.port, () => {
  console.log(`⚡️ [Server]: Server is running at http://localhost:${config.port}`);
  console.log(`⚡️ Environment: ${config.env}`);
});
