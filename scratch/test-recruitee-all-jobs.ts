import { chromium } from "playwright";
import { RecruiteeAdapter } from "../src/ats/recruitee/recruitee.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import path from "path";

const RECRUITEE_JOBS = [
  "https://zeromotorcycles.recruitee.com/o/functional-safety-engineer",
  "https://zeromotorcycles.recruitee.com/o/legal-counsel",
  "https://zeromotorcycles.recruitee.com/o/sales-operations-coordinator",
  "https://companiongroupltd.recruitee.com/o/senior-backend-engineer",
  "https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha",
  "https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new"
];

const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const adapter = new RecruiteeAdapter();

  const profile: UserProfile = {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
    phone: "2025550198",
    location: "San Francisco, CA, United States",
    street: "123 Market St",
    city: "San Francisco",
    state: "California",
    zipCode: "94105",
    country: "United States",
    willingToRelocate: true,
    yearsOfExperience: 5,
    gender: "Male"
  };

  for (let i = 0; i < RECRUITEE_JOBS.length; i++) {
    const url = RECRUITEE_JOBS[i];
    console.log(`\n======================================================================`);
    console.log(`[TESTING JOB ${i + 1}/${RECRUITEE_JOBS.length}]: ${url}`);

    const context = await browser.newContext({
      viewport: { width: 1280, height: 1200 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForTimeout(2000);

      console.log("Calling adapter.fillForm()...");
      await adapter.fillForm(page, profile, {});

      console.log("Calling adapter.uploadResume()...");
      await adapter.uploadResume(page, resumePath, [], profile);

      // Now audit all fields on the page to see what was filled vs what is still empty!
      const audit = await page.evaluate(() => {
        const form = document.querySelector("form");
        if (!form) return { error: "No form" };

        const elements = Array.from(form.querySelectorAll("input, select, textarea, button[id*='country-select']"));
        const report: any[] = [];

        // Check radio groups
        const radioGroups: Record<string, any[]> = {};
        for (const el of Array.from(form.querySelectorAll("input[type='radio']"))) {
          const r = el as HTMLInputElement;
          const name = r.name || "unknown";
          if (!radioGroups[name]) radioGroups[name] = [];
          radioGroups[name].push(r);
        }

        // Auditing all non-radio inputs
        for (const el of elements) {
          const tag = el.tagName.toLowerCase();
          const type = (el as HTMLInputElement).type || "";
          if (type === "hidden" || type === "radio") continue;

          const name = (el as HTMLInputElement).name || el.id;
          const value = (el as HTMLInputElement).value || "";
          const isChecked = (el as HTMLInputElement).checked;

          let label = "";
          if (el.id) {
            const l = document.querySelector(`label[for="${el.id}"]`);
            if (l) label = l.textContent || "";
          }
          if (!label) {
            const l = el.closest("label");
            if (l) label = l.textContent || "";
          }
          if (!label) {
            let p = el.parentElement;
            for (let k = 0; k < 5 && p; k++) {
              const h = p.querySelector("label, h3, h4, h5, [class*='title'], [class*='label']");
              if (h && !h.contains(el)) {
                label = h.textContent || "";
                break;
              }
              p = p.parentElement;
            }
          }

          let text = "";
          if (tag === "button") {
            text = (el.textContent || "").trim();
          }

          let filled = false;
          if (type === "checkbox") {
            filled = isChecked;
          } else if (tag === "button") {
            filled = text.includes("United States") || text.includes("+1");
          } else if (type === "file") {
            filled = (el as HTMLInputElement).files && (el as HTMLInputElement).files!.length > 0;
          } else {
            filled = value.trim().length > 0;
          }

          report.push({
            tag,
            type,
            name,
            label: label.trim().replace(/\s+/g, " "),
            value: type === "checkbox" ? isChecked : (tag === "button" ? text : value),
            filled
          });
        }

        // Auditing radio groups
        const radioReport: any[] = [];
        for (const [name, radios] of Object.entries(radioGroups)) {
          let selectedValue = "";
          let selectedLabel = "";
          let groupLabel = "";

          const first = radios[0];
          let p = first.parentElement;
          for (let k = 0; k < 6 && p; k++) {
            const h = p.querySelector("h3, h4, h5, [class*='title'], [class*='question'], label:not([class*='radio'])");
            if (h && !h.contains(first)) {
              groupLabel = (h.textContent || "").trim().replace(/\s+/g, " ");
              break;
            }
            p = p.parentElement;
          }

          for (const r of radios) {
            if (r.checked) {
              selectedValue = r.value;
              const parentLabel = r.closest("label");
              selectedLabel = (parentLabel?.textContent || "").trim();
              break;
            }
          }

          radioReport.push({
            name,
            groupLabel,
            hasSelection: !!selectedValue,
            selectedLabel,
            selectedValue
          });
        }

        return { report, radioReport };
      });

      console.log(`\n📋 AUDIT RESULTS FOR JOB ${i + 1}:`);
      console.log("FIELDS:");
      for (const f of (audit as any).report || []) {
        const mark = f.filled ? "✅" : "❌ UNFILLED";
        console.log(`  ${mark} [${f.type || f.tag}] "${f.label}" -> "${f.value}"`);
      }

      console.log("RADIO GROUPS:");
      for (const r of (audit as any).radioReport || []) {
        const mark = r.hasSelection ? "✅" : "❌ UNSELECTED";
        console.log(`  ${mark} "${r.groupLabel}" -> selected: "${r.selectedLabel}"`);
      }

    } catch (err: any) {
      console.error(`Error on Job ${i + 1}:`, err.message);
    } finally {
      await context.close();
    }
  }

  await browser.close();
}

main().catch(console.error);
