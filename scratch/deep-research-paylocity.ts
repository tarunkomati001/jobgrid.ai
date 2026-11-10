import { chromium, Page } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { PaylocityAdapter } from "../src/ats/paylocity/paylocity.adapter";
import { db } from "../src/database/db";
import { UserProfile } from "../src/ats/ats.interface";
import { resolveLocalResumePath } from "../src/utils/path-resolver";
import { normalizeLabel } from "../src/application/field-mapper";
import path from "path";
import fs from "fs";

const TARGET_JOBS = [
  { id: 1, url: "https://recruiting.paylocity.com/recruiting/jobs/Details/4448048/Inadev/Developer" },
  { id: 2, url: "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4358710" },
  { id: 3, url: "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4606392" },
  { id: 4, url: "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4605123" }
];

async function getHrutinProfile(): Promise<{ profile: UserProfile; savedAnswers: Map<string, string> }> {
  const userRes = await db.query(
    "SELECT * FROM users WHERE id = 'usr_hrutin_nammi' OR email = 'babufakemail@gmail.com'"
  );
  if (userRes.rows.length === 0) {
    throw new Error("Candidate Hrutin not found in database!");
  }
  const user = userRes.rows[0];

  const profRes = await db.query("SELECT * FROM user_profiles WHERE user_id = $1", [user.id]);
  const p = profRes.rows[0] || {};

  const resumeRes = await db.query(
    "SELECT * FROM resumes WHERE user_id = $1 AND (resume_type = 'PDF' OR resume_type IS NULL) ORDER BY created_at DESC LIMIT 1",
    [user.id]
  );
  const rawResumePath = resumeRes.rows[0]?.file_path || "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf";
  const resumePath = resolveLocalResumePath(rawResumePath);

  const profile: UserProfile = {
    userId: user.id,
    firstName: p.first_name || "Hrutin",
    lastName: p.last_name || "Nammi",
    middleName: "",
    email: user.email,
    phone: p.phone || "+12025550198",
    location: p.location || "San Francisco, CA, United States",
    street: "123 Market St",
    city: "San Francisco",
    state: "California",
    zipCode: "94105",
    country: "United States",
    linkedinUrl: p.linkedin_url || "https://linkedin.com/in/hrutinnammi",
    githubUrl: p.github_url || "https://github.com/hrutinnammi",
    portfolioUrl: p.portfolio_url || "https://linkedin.com/in/hrutinnammi",
    willingToRelocate: p.willing_to_relocate !== undefined ? Boolean(p.willing_to_relocate) : true,
    yearsOfExperience: p.years_of_experience || 2,
    gender: p.gender || "Male",
    resumePath: resumePath
  };

  const ansRes = await db.query(
    "SELECT normalized_question, answer FROM user_saved_answers WHERE user_id = $1",
    [user.id]
  );
  const savedAnswers = new Map<string, string>();
  for (const row of ansRes.rows) {
    savedAnswers.set(normalizeLabel(row.normalized_question), row.answer);
  }

  return { profile, savedAnswers };
}

async function inspectStepFields(page: Page): Promise<any[]> {
  return await page.evaluate(() => {
    const items: any[] = [];
    // Select all inputs, textareas, selects, and rw-dropdownlists
    const elements = Array.from(document.querySelectorAll("input, textarea, select, .rw-dropdownlist, div[role='combobox']"));

    for (const el of elements) {
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetParent === null && htmlEl.getAttribute("type") !== "file") {
        continue; // invisible
      }

      const id = el.getAttribute("id") || "";
      const name = el.getAttribute("name") || "";
      const dataFor = el.getAttribute("data-for") || el.getAttribute("data-automation-id") || "";
      const tagName = el.tagName.toLowerCase();
      const type = (el as any).type || el.getAttribute("role") || tagName;

      // Skip honeypots or internal controls
      if (id.includes("vendor-search") || id.includes("ot-group")) continue;

      let label = dataFor;
      if (!label) {
        const formGroup = el.closest(".form-group, .question, .card, fieldset");
        if (formGroup) {
          const lEl = formGroup.querySelector("label, legend, h3, h4, strong");
          if (lEl) label = lEl.textContent?.trim() || "";
        }
      }
      if (!label) {
        const prevLabel = el.previousElementSibling;
        if (prevLabel && prevLabel.tagName.toLowerCase() === "label") {
          label = prevLabel.textContent?.trim() || "";
        }
      }

      let value = "";
      if (tagName === "input" || tagName === "textarea") {
        value = (el as HTMLInputElement).value;
        if ((el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio") {
          value = (el as HTMLInputElement).checked ? "CHECKED" : "UNCHECKED";
        }
      } else if (tagName === "select") {
        value = (el as HTMLSelectElement).value;
      } else if (el.classList.contains("rw-dropdownlist")) {
        const rwInput = el.querySelector(".rw-input");
        value = rwInput?.textContent?.trim() || "";
      }

      items.push({
        id,
        name,
        dataFor,
        label,
        type,
        value
      });
    }

    return items;
  });
}

async function runResearch() {
  console.log("===============================================================================");
  console.log("🔍 PAYLOCITY ATS DEEP RESEARCH & MULTI-JOB APPLICATION AUDIT");
  console.log("===============================================================================\n");

  const { profile, savedAnswers } = await getHrutinProfile();
  console.log(`👤 Candidate: ${profile.firstName} ${profile.lastName}`);
  console.log(`📧 Email: ${profile.email}`);
  console.log(`📚 Database Saved Answers: ${savedAnswers.size} entries loaded\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });

  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1366, height: 900 }
  });
  await applyStealthScripts(context);

  const adapter = new PaylocityAdapter();
  const allDiscoveredNewFields: any[] = [];

  for (const job of TARGET_JOBS) {
    console.log("\n===============================================================================");
    console.log(`🚀 [JOB ${job.id}/4]: ${job.url}`);
    console.log("===============================================================================");

    const page = await context.newPage();
    try {
      // 1. Navigate to Job Details
      console.log(`🌐 Navigating to Job ${job.id}...`);
      await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(3000);

      // Detect & Extract Job
      const isPaylocity = await adapter.detect(page);
      console.log(`🎯 ATS Detection: ${isPaylocity ? "✅ PAYLOCITY CONFIRMED" : "❌ NOT DETECTED"}`);

      const details = await adapter.extractJob(page);
      console.log(`📌 Extracted Job: "${details.title}" at "${details.company}"`);

      // 2. Perform Autofill with Hrutin details
      console.log(`\n🤖 Running PaylocityAdapter.fillForm()...`);
      await adapter.fillForm(page, profile);

      // 3. Inspect final state of the page
      console.log(`\n🧐 Inspecting all rendered form fields on Job ${job.id}...`);
      const fields = await inspectStepFields(page);
      console.log(`📊 Found ${fields.length} active inputs/controls.`);

      let emptyRequiredCount = 0;
      for (const f of fields) {
        const queryKey = f.label || f.dataFor || f.name || f.id;
        const normKey = normalizeLabel(queryKey);
        const hasDbAnswer = savedAnswers.has(normKey) || (profile as any)[normKey] !== undefined;

        const isFilled = f.value && f.value !== "--" && f.value !== "Select..." && f.value !== "UNCHECKED";

        if (!isFilled && f.type !== "hidden") {
          console.log(`  ❓ [UNFILLED/EMPTY]: id="${f.id}" label="${f.label}" data-for="${f.dataFor}" type="${f.type}" value="${f.value}"`);
          if (!hasDbAnswer) {
            allDiscoveredNewFields.push({
              jobId: job.id,
              jobTitle: details.title,
              fieldId: f.id,
              label: f.label,
              dataFor: f.dataFor,
              type: f.type
            });
            console.log(`  🚨 [TERMINAL CALL]: NEW FIELD NOT IN DATABASE: "${f.label || f.dataFor || f.id}" (Job ${job.id})`);
          }
        } else {
          console.log(`  ✅ [FILLED]: "${f.label || f.id}" -> "${f.value.slice(0, 50)}"`);
        }
      }

      // Check for any validation error messages on screen
      const errors = await page.locator(".has-error, .text-danger, span[style*='color: red'], .field-validation-error").allInnerTexts().catch(() => []);
      const visibleErrors = errors.filter(e => e.trim().length > 0);
      if (visibleErrors.length > 0) {
        console.warn(`  ⚠️ Validation Errors on Screen:`, visibleErrors);
      } else {
        console.log(`  🌟 No validation errors found! Application clean and ready.`);
      }

      // Take screenshot
      const shotPath = path.resolve(`scratch/paylocity_job_${job.id}_final.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${shotPath}`);

    } catch (err: any) {
      console.error(`❌ Error during Job ${job.id}:`, err.message);
      const errShot = path.resolve(`scratch/paylocity_job_${job.id}_error.png`);
      await page.screenshot({ path: errShot, fullPage: true }).catch(() => {});
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log("\n===============================================================================");
  console.log("🏁 SUMMARY OF DEEP RESEARCH & FIELD MAPPINGS");
  console.log("===============================================================================");
  if (allDiscoveredNewFields.length > 0) {
    console.log(`⚠️ FOUND ${allDiscoveredNewFields.length} FIELDS REQUIRING ATTENTION / TERMINAL CALL:`);
    for (const nf of allDiscoveredNewFields) {
      console.log(`  - Job ${nf.jobId}: "${nf.label || nf.dataFor || nf.fieldId}" (type: ${nf.type})`);
    }
  } else {
    console.log("🎉 ALL FIELDS ACROSS ALL 4 PAYLOCITY JOBS WERE SUCCESSFULLY FILLED AND MAPPED!");
  }
}

runResearch().catch(console.error);
