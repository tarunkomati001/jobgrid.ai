import { chromium } from "playwright";
import { RecruiteeAdapter } from "../src/ats/recruitee/recruitee.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";
import fs from "fs";

const RECRUITEE_JOBS = [
  "https://zeromotorcycles.recruitee.com/o/functional-safety-engineer",
  "https://zeromotorcycles.recruitee.com/o/legal-counsel",
  "https://zeromotorcycles.recruitee.com/o/sales-operations-coordinator",
  "https://companiongroupltd.recruitee.com/o/senior-backend-engineer",
  "https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha",
  "https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new"
];

const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function deepTestAll() {
  console.log("===============================================================================");
  console.log("🧪 DEEP VERIFICATION OF RECRUITEE ADAPTER ACROSS ALL RECRUITEE JOBS");
  console.log("===============================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const adapter = new RecruiteeAdapter();

  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
    phone: "2025550198",
    location: "San Francisco, CA, USA",
    street: "123 Market St",
    city: "San Francisco",
    state: "California",
    zipCode: "94105",
    country: "United States",
    willingToRelocate: true,
    yearsOfExperience: 5,
    gender: "Male"
  };

  const results: any[] = [];

  for (let i = 0; i < RECRUITEE_JOBS.length; i++) {
    const url = RECRUITEE_JOBS[i];
    console.log(`\n-------------------------------------------------------------------------------`);
    console.log(`[JOB ${i + 1}/${RECRUITEE_JOBS.length}] Testing: ${url}`);
    console.log(`-------------------------------------------------------------------------------`);

    const context = await browser.newContext({
      viewport: { width: 1280, height: 1200 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    try {
      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForTimeout(2000);

      console.log("Calling adapter.fillForm()...");
      await adapter.fillForm(page, profile);

      console.log("Calling adapter.uploadResume()...");
      await adapter.uploadResume(page, resumePath, [], profile);

      console.log("Calling adapter.validate()...");
      const isValid = await adapter.validate(page);
      console.log(`Validation result: ${isValid ? "✅ VALID" : "❌ INVALID"}`);

      // Deep audit of the form
      const audit = await page.evaluate(() => {
        const form = document.querySelector("form");
        if (!form) return { error: "No form" };

        const countryBtn = document.querySelector("button[id*='country-select']");
        const countryText = countryBtn ? (countryBtn.textContent || "").trim() : "";

        // Radio group audit
        const radioGroups: Record<string, { radios: HTMLInputElement[]; legend: string }> = {};
        for (const r of Array.from(form.querySelectorAll("input[type='radio']")) as HTMLInputElement[]) {
          const name = r.name || "unknown";
          if (!radioGroups[name]) {
            const fs = r.closest("fieldset");
            radioGroups[name] = { radios: [], legend: fs?.querySelector("legend")?.textContent?.trim() || "" };
          }
          radioGroups[name].radios.push(r);
        }

        const radioAudit: any[] = [];
        for (const [name, g] of Object.entries(radioGroups)) {
          const selected = g.radios.find(r => r.checked);
          let selectedText = "";
          if (selected) {
            const parentLabel = selected.closest("label");
            const sibLabel = selected.parentElement?.querySelector("label");
            selectedText = parentLabel?.textContent?.trim() || sibLabel?.textContent?.trim() || selected.value;
          }
          radioAudit.push({
            name,
            question: g.legend,
            answered: !!selected,
            selectedOption: selectedText
          });
        }

        // Standard inputs audit
        const allInputs = Array.from(form.querySelectorAll("input, textarea, select"));
        const fieldAudit: any[] = [];
        for (const el of allInputs) {
          const type = (el as HTMLInputElement).type || el.tagName.toLowerCase();
          if (type === "hidden" || type === "radio") continue;

          const val = (el as HTMLInputElement).value || "";
          const isChecked = (el as HTMLInputElement).checked;

          let label = "";
          if (el.id) {
            const l = document.querySelector(`label[for="${el.id}"]`);
            if (l) label = l.textContent || "";
          }
          if (!label) {
            const l = el.parentElement?.querySelector("label");
            if (l && l !== el) label = l.textContent || "";
          }
          if (!label) {
            const l = el.closest("label");
            if (l) label = l.textContent || "";
          }

          let filled = false;
          if (type === "checkbox") {
            filled = isChecked;
          } else if (type === "file") {
            filled = !!((el as HTMLInputElement).files && (el as HTMLInputElement).files!.length > 0);
          } else {
            filled = val.trim().length > 0;
          }

          fieldAudit.push({
            type,
            name: (el as HTMLInputElement).name || el.id,
            label: label.trim().replace(/\s+/g, " "),
            filled,
            sampleVal: val.length > 50 ? `${val.slice(0, 50)}...` : val
          });
        }

        const unselectedRadios = radioAudit.filter(r => !r.answered);
        const unfilledFields = fieldAudit.filter(f => !f.filled && f.type !== "checkbox"); // only non-optional

        return {
          countryText,
          radioAudit,
          fieldAudit,
          unselectedRadios,
          unfilledFields,
          totalQuestions: radioAudit.length + fieldAudit.length
        };
      });

      console.log(`\n📋 AUDIT FOR JOB ${i + 1}:`);
      console.log(`Country Code Selector: "${(audit as any).countryText}"`);
      console.log(`Radio Groups: ${(audit as any).radioAudit?.length || 0} total:`);
      for (const r of (audit as any).radioAudit || []) {
        console.log(`  ${r.answered ? "✅" : "❌"} [Radio] "${r.question.slice(0, 40)}..." -> "${r.selectedOption}"`);
      }

      console.log(`Fields & Dropdowns: ${(audit as any).fieldAudit?.length || 0} total:`);
      for (const f of (audit as any).fieldAudit || []) {
        console.log(`  ${f.filled ? "✅" : "❌"} [${f.type}] "${f.label}" -> "${f.sampleVal}"`);
      }

      // Take screenshot
      const scrPath = path.resolve(`scratch/recruitee_job${i + 1}_verified.png`);
      await page.screenshot({ path: scrPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${scrPath}`);

      const cookiePopupCount = await page.locator("#cookie-dialog-title, [role='dialog'][aria-labelledby*='cookie']").count();
      console.log(`🍪 Cookie Dialog Count on page: ${cookiePopupCount}`);

      const success = (audit as any).unselectedRadios?.length === 0 && (audit as any).unfilledFields?.length === 0 && cookiePopupCount === 0;
      results.push({
        url,
        valid: isValid,
        cookiePopupCount,
        success,
        country: (audit as any).countryText,
        unfilled: (audit as any).unfilledFields,
        unselectedRadios: (audit as any).unselectedRadios
      });

    } catch (err: any) {
      console.error(`❌ Error on Job ${i + 1}:`, err.message);
      results.push({ url, error: err.message, success: false });
    } finally {
      await context.close();
    }
  }

  await browser.close();

  console.log(`\n===============================================================================`);
  console.log("FINAL RESULTS SUMMARY ACROSS ALL 6 RECRUITEE JOBS:");
  console.log(`===============================================================================`);
  let allPass = true;
  for (let idx = 0; idx < results.length; idx++) {
    const r = results[idx];
    const status = r.success ? "✅ 100% PASSED (ALL FIELDS & QUESTIONS ANSWERED)" : "❌ FAILED";
    if (!r.success) allPass = false;
    console.log(`Job ${idx + 1}: ${status} | Country: "${r.country}" | Valid: ${r.valid} | URL: ${r.url}`);
  }

  if (allPass) {
    console.log(`\n🎉 ALL 6 RECRUITEE JOBS PASSED WITH 100% SUCCESS!`);
  } else {
    console.error(`\n⚠️ Some jobs had unfilled fields.`);
  }
}

deepTestAll().catch(console.error);
