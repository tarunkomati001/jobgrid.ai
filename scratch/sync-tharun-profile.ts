import { chromium } from "playwright";
import { syncWellfoundProfile, attemptWellfoundLogin } from "../src/ats/wellfound/wellfound-auth";
import { UserProfile } from "../src/ats/ats.interface";

async function main() {
  console.log("===============================================================================");
  console.log("🌐 COMPLETING ONBOARDING & PROFILE SYNC FOR THARUN KOMITE");
  console.log("===============================================================================\n");

  const email = "tharunkomite7@gmail.com";
  const pass = "TharunDev@2024!";
  const name = "Tharun Komite";

  const tharunProfile: UserProfile = {
    userId: "usr_tharun_komite",
    email,
    firstName: "Tharun",
    lastName: "Komite",
    phone: "+1 202 555 0198",
    location: "San Francisco, CA, United States",
    linkedinUrl: "https://linkedin.com/in/tharunkomite",
    githubUrl: "https://github.com/tharunkomite",
    portfolioUrl: "https://tharunkomite.dev",
    resumePath: "resumes/user_usr_tharun_komite/Tharun_Komite_Resume.pdf",
    bio: "Full-Stack Developer and AI Engineer specializing in Python, FastAPI, React, RAG, and modern cloud infrastructure."
  };

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Sign in with the newly created credentials
  console.log("👉 1. Signing in with new credentials on https://wellfound.com/login...");
  await page.goto("https://wellfound.com/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  await page.locator("input#user_email, input[type='email']").first().fill(email);
  await page.waitForTimeout(300);
  await page.locator("input#user_password, input[type='password']").first().fill(pass);
  await page.waitForTimeout(400);

  const loginBtn = page.locator("input[type='submit'][value*='Log in' i], input[type='submit'], button[type='submit']").first();
  await loginBtn.click();
  await page.waitForTimeout(5000);

  console.log("URL after login:", page.url());
  console.log("Title after login:", await page.title());

  // 2. Synchronize profile details & links
  console.log("👉 2. Syncing profile, resume PDF, and all social links...");
  await syncWellfoundProfile(page, tharunProfile);

  await page.screenshot({ path: "scratch/tharun_profile_synced_final.png" });
  console.log("📸 Screenshot saved to scratch/tharun_profile_synced_final.png");

  console.log("🎉 Tharun Komite's account is 100% set up and ready to apply to jobs!");
  await page.waitForTimeout(5000);
  await browser.close();
}

main().catch(console.error);

