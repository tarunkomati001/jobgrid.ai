import { chromium } from "playwright";
import { LeverAdapter } from "../src/ats/lever/lever.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import { resolveLocalResumePath } from "../src/utils/path-resolver";
import { db } from "../src/database/db";

async function testLeverDeep() {
  process.env.AUTO_SUBMIT = "true";
  console.log("🔍 [Lever Deep Test]: Starting deep diagnostic test on Lever ATS (AUTO_SUBMIT=true)...");

  // 1. Fetch user profile from DB
  const userRes = await db.query(
    "SELECT u.id, u.email, p.* FROM users u JOIN user_profiles p ON u.id = p.user_id WHERE u.email LIKE '%hrutin%' OR p.first_name ILIKE '%hrutin%' LIMIT 1"
  );
  
  if (userRes.rowCount === 0) {
    console.error("User not found!");
    process.exit(1);
  }
  
  const user = userRes.rows[0];
  const profile: UserProfile = {
    firstName: user.first_name || "Hrutin",
    lastName: user.last_name || "Nammi",
    email: user.email || "babufakemail@gmail.com",
    phone: (user.phone || "9876543210").replace(/\D/g, "").slice(-10),
    location: user.location || "Vadodara, Gujarat, India",
    linkedinUrl: user.linkedin_url || "https://linkedin.com/in/hrutin",
    githubUrl: user.github_url || "https://github.com/hrutin",
    portfolioUrl: user.portfolio_url || "https://hrutin.dev",
    gender: user.gender || "Male",
    willingToRelocate: true,
    yearsOfExperience: user.years_of_experience || 3
  };

  const resumeRes = await db.query(
    "SELECT id, file_name, file_path FROM resumes WHERE user_id = $1 AND is_active = 1 LIMIT 1",
    [user.user_id]
  );
  const resumePath = resumeRes.rowCount > 0 ? resolveLocalResumePath(resumeRes.rows[0].file_path) : "";

  const jobUrl = "https://jobs.lever.co/sonatype/dc2c0041-d681-4b0b-b113-b99984af95f4/apply";

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--start-maximized"
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();

  // Listen to network responses to see if Lever API returns 200, 400, or bot challenge
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/apply") || url.includes("hcaptcha") || url.includes("lever.co")) {
      if (res.request().method() === "POST") {
        console.log(`📡 [POST Response] ${res.status()} ${url}`);
        try {
          const body = await res.text();
          console.log(`   Response Body Preview: ${body.slice(0, 200)}`);
        } catch (e) {}
      }
    }
  });

  console.log(`🌐 Navigating to ${jobUrl}...`);
  await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".application-form, #application-form, form", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const adapter = new LeverAdapter();

  console.log("📄 Uploading resume...");
  if (resumePath) {
    await adapter.uploadResume(page, resumePath);
  }

  console.log("📝 Filling Lever form with graphical mouse movements...");
  await adapter.fillForm(page, profile, {
    "current_company": "Independent Consultant",
    "notice_period": "Immediate",
    "expected_salary": "$120,000"
  });

  console.log("🔍 Validating form...");
  const isValid = await adapter.validate(page);
  console.log("Form is valid:", isValid);

  console.log("⏳ Pausing 2s before submit test...");
  await page.waitForTimeout(2000);

  console.log("🚀 Testing submit execution...");
  const result = await adapter.submit(page);
  console.log("Submit result:", result);

  console.log("⏳ Keeping browser open for 20s to observe post-submit state...");
  await page.waitForTimeout(20000);

  await browser.close();
}

testLeverDeep().catch(console.error);
