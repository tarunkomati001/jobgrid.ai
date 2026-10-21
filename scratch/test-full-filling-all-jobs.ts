import { chromium } from "playwright";
import { UserProfile } from "../src/ats/ats.interface";
import { normalizeLabel } from "../src/application/field-mapper";
import { suggestAnswerForQuestion } from "../src/application/question-answering";

const RECRUITEE_JOBS = [
  "https://zeromotorcycles.recruitee.com/o/functional-safety-engineer",
  "https://zeromotorcycles.recruitee.com/o/legal-counsel",
  "https://zeromotorcycles.recruitee.com/o/sales-operations-coordinator",
  "https://companiongroupltd.recruitee.com/o/senior-backend-engineer",
  "https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha",
  "https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new"
];

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

async function testFillFlow(page: any, url: string) {
  // 1. Ensure /c/new
  console.log(`\n======================================================`);
  console.log(`Starting test on: ${url}`);
  const targetUrl = url.endsWith("/c/new") ? url : `${url.replace(/\/$/, "")}/c/new`;
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
  await page.waitForTimeout(2000);

  // Check that application form is visible
  await page.waitForSelector("form, input[name='candidate.name']", { timeout: 15000 }).catch(() => {});

  // 2. Candidate Name
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const nameInput = page.locator("input[name='candidate.name']").first();
  if (await nameInput.count() > 0) {
    await nameInput.fill(fullName);
    console.log(`👤 Name filled: ${fullName}`);
  }

  // 3. Email
  const emailInput = page.locator("input[name='candidate.email']").first();
  if (await emailInput.count() > 0) {
    await emailInput.fill(profile.email);
    console.log(`📧 Email filled: ${profile.email}`);
  }

  // 4. Country Code and Phone
  const countryBtn = page.locator("button[id*='country-select'], button[aria-label*='Select country calling code']").first();
  const phoneInput = page.locator("input[name='candidate.phone'], input[type='tel']").first();

  if (await countryBtn.count() > 0) {
    const currentText = await countryBtn.innerText().catch(() => "");
    if (!currentText.includes("United States")) {
      await countryBtn.click();
      await page.waitForTimeout(300);

      const clicked = await page.evaluate(async () => {
        const scrollEl = document.querySelector(".sc-2arzqk-1") as HTMLElement;
        if (!scrollEl) return false;

        for (let top = 13000; top <= 14000; top += 100) {
          scrollEl.scrollTop = top;
          scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
          await new Promise(r => setTimeout(r, 20));

          const opts = Array.from(document.querySelectorAll("[role='option']"));
          const us = opts.find(o => o.getAttribute("aria-label") === "United States" || o.textContent?.includes("United States"));
          if (us) {
            (us as HTMLElement).click();
            return true;
          }
        }
        return false;
      });
      console.log(`📞 Country selector clicked: ${clicked}`);
      await page.waitForTimeout(300);

      if (await page.locator("[role='listbox']").count() > 0) {
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(200);
      }
    }
  }

  if (await phoneInput.count() > 0) {
    const formattedUS = "+1 202 555 0198";
    await phoneInput.click();
    await phoneInput.fill("");
    await phoneInput.pressSequentially(formattedUS, { delay: 30 });
    await page.waitForTimeout(200);
    console.log(`📞 Phone filled: ${formattedUS} (Country now: ${await countryBtn.innerText().catch(() => "")})`);
  }

  // 5. Consent checkbox
  const consent = page.locator("input[name='candidate.textingConsent'], input#candidateTextingConsent").first();
  if (await consent.count() > 0) {
    if (!(await consent.isChecked().catch(() => false))) {
      await consent.click({ force: true }).catch(() => {});
      console.log(`☑️ Texting consent checked`);
    }
  }

  // Helper to extract accurate label
  const getAccurateLabel = async (locator: any) => {
    return await locator.evaluate((el: HTMLElement) => {
      if (el.id) {
        const l = document.querySelector(`label[for="${el.id}"]`);
        if (l) return l.textContent || "";
      }
      const parentLabel = el.parentElement?.querySelector("label");
      if (parentLabel && parentLabel !== el) {
        return parentLabel.textContent || "";
      }
      const fs = el.closest("fieldset");
      if (fs) {
        const leg = fs.querySelector("legend");
        if (leg) return leg.textContent || "";
      }
      const closestLabel = el.closest("label");
      if (closestLabel) return closestLabel.textContent || "";

      let cur = el.parentElement;
      for (let i = 0; i < 4 && cur; i++) {
        const h = cur.querySelector("label, [class*='title'], [class*='question']");
        if (h && !h.contains(el)) return h.textContent || "";
        cur = cur.parentElement;
      }
      return (el as HTMLInputElement).placeholder || (el as HTMLInputElement).name || "";
    }).catch(() => "");
  };

  // 6. Number inputs (Salary)
  const numberInputs = await page.locator("input[type='number']").all();
  for (const numInput of numberInputs) {
    const label = await getAccurateLabel(numInput);
    const norm = normalizeLabel(label);
    let target = "95000";
    if (norm.includes("salary") || norm.includes("compensation") || norm.includes("base")) {
      target = "95000";
    }
    await numInput.fill(target);
    console.log(`🔢 Number filled [${label}] -> ${target}`);
  }

  // 7. Text inputs
  const textInputs = await page.locator("input[type='text']:not([name='candidate.name'])").all();
  for (const tInput of textInputs) {
    const label = await getAccurateLabel(tInput);
    const norm = normalizeLabel(label);
    let target = "";
    if (norm.includes("city") || norm.includes("residence")) {
      target = profile.city || "San Francisco";
    } else if (norm.includes("english")) {
      target = "Fluent / Professional Working Proficiency";
    } else if (norm.includes("compensation") || norm.includes("additional")) {
      target = "Standard benefits package and performance bonuses; flexible and negotiable based on role requirements.";
    } else if (norm.includes("notice period") || norm.includes("start date")) {
      target = "Immediate";
    } else if (norm.includes("salary")) {
      target = "$95,000";
    } else {
      target = suggestAnswerForQuestion(label);
    }
    if (target) {
      await tInput.fill(target);
      console.log(`✍️ Text filled [${label}] -> ${target}`);
    }
  }

  // 8. Textareas
  const textareas = await page.locator("textarea").all();
  for (const ta of textareas) {
    const label = await getAccurateLabel(ta);
    const norm = normalizeLabel(label);
    let essay = "";
    if (norm.includes("backend") || norm.includes("multiplayer") || norm.includes("scale") || norm.includes("designed or maintained")) {
      essay = "At Jobspring and on LocalMind OS, I designed and maintained high-throughput distributed backend services using FastAPI, Node.js, and Redis. The architecture solved heavy data payload processing bottlenecks by implementing asynchronous worker queues, FAISS vector index caching, and optimized database connection pooling. To handle traffic spikes, the services were containerized with Docker and orchestrated to scale horizontally with load balancers, cutting response latency by 30% under peak concurrency.";
    } else if (norm.includes("azure openai") || norm.includes("agentic ai") || norm.includes("ai solutions") || norm.includes("production experience")) {
      essay = "Yes, I have extensive production experience building AI solutions with OpenAI and Azure OpenAI APIs, along with agentic frameworks. I built end-to-end RAG pipelines using vector indexing (FAISS), chunking workflows, prompt orchestration, and FastAPI services deployed to Azure App Service and Azure Blob Storage. In addition, I have implemented agentic workflows with autonomous tool calling, structured outputs, and fallback mechanisms for enterprise use cases.";
    } else if (norm.includes("cover letter")) {
      essay = "Dear Hiring Manager,\n\nI am a Full-Stack AI Developer experienced in building scalable AI applications, RAG pipelines, FastAPI backends, and React interfaces. At Jobspring, I developed an AI resume platform serving 50+ users and reduced API latency by 30%. I am excited to bring my expertise in Python, React, LLMs, and cloud deployments to your team.\n\nBest regards,\nHrutin Nammi";
    } else {
      essay = suggestAnswerForQuestion(label);
    }
    if (essay) {
      await ta.fill(essay);
      console.log(`📝 Textarea filled [${label.slice(0, 45)}...]`);
    }
  }

  // 9. Radio groups
  const radioInputs = await page.locator("input[type='radio']").all();
  const radioGroups: Record<string, any[]> = {};
  for (const r of radioInputs) {
    const name = (await r.getAttribute("name").catch(() => "")) || "unknown";
    if (!radioGroups[name]) radioGroups[name] = [];
    radioGroups[name].push(r);
  }

  for (const [name, radios] of Object.entries(radioGroups)) {
    if (radios.length === 0) continue;

    // Get group question from fieldset legend or container
    const questionText = await radios[0].evaluate((el: HTMLElement) => {
      const fs = el.closest("fieldset");
      if (fs) {
        const leg = fs.querySelector("legend");
        if (leg) return leg.textContent || "";
      }
      let cur = el.parentElement;
      for (let i = 0; i < 5 && cur; i++) {
        const h = cur.querySelector("h3, h4, h5, [class*='title'], [class*='question'], [class*='Label']");
        if (h && !h.contains(el)) return h.textContent || "";
        cur = cur.parentElement;
      }
      return "";
    }).catch(() => "");

    const normQ = normalizeLabel(questionText);

    for (const r of radios) {
      const optText = await r.evaluate((el: HTMLElement) => {
        const parentLabel = el.closest("label");
        if (parentLabel) return parentLabel.textContent || "";
        const sibling = el.parentElement?.querySelector("label");
        if (sibling) return sibling.textContent || "";
        return (el as HTMLInputElement).value || "";
      }).catch(() => "");

      const normOpt = normalizeLabel(optText);
      let select = false;

      // 1. Sponsorship question: "Do you require sponsorship or a visa to be eligible to work in The Netherlands?" -> No
      if (normQ.includes("require sponsorship") || normQ.includes("sponsorship") || normQ.includes("require visa")) {
        select = normOpt === "no" || normOpt.includes("not require");
      }
      // 2. Legal authorization / right to work
      else if (normQ.includes("authorized") || normQ.includes("right to work") || normQ.includes("legally authorized")) {
        select = normOpt === "yes" || normOpt.includes("authorized") || normOpt.includes("permanent resident") || normOpt.includes("valid work visa") || normOpt.includes("citizen");
      }
      // 3. Statement acknowledgement
      else if (normQ.includes("understand") || normQ.includes("statement") || normQ.includes("agree") || normQ.includes("background check") || normQ.includes("cognitive") || normQ.includes("assessment")) {
        select = normOpt.includes("yes") || normOpt.includes("understand") || normOpt.includes("agree");
      }
      // 4. State
      else if (normQ.includes("state") || normQ.includes("territory") || normQ.includes("residence")) {
        select = normOpt === "california";
      }
      // 5. Gender
      else if (normQ.includes("gender")) {
        select = normOpt === "male";
      }
      // 6. Race / Ethnicity
      else if (normQ.includes("race") || normQ.includes("population") || normQ.includes("ethnic")) {
        select = normOpt.includes("indian") || normOpt.includes("asian");
      }
      // 7. Years of experience
      else if (normQ.includes("years") || normQ.includes("experience")) {
        select = normOpt.includes("3 to 6") || normOpt.includes("3-6") || normOpt.includes("6+") || normOpt.includes("yes");
      }
      // 8. German fluency
      else if (normQ.includes("german") || normQ.includes("fluent")) {
        select = normOpt === "yes";
      }
      // Fallback
      else if (normOpt === "yes") {
        select = true;
      }

      if (select) {
        await r.click({ force: true }).catch(() => {});
        // Also click parent/sibling label if not checked
        const checked = await r.isChecked().catch(() => false);
        if (!checked) {
          await r.evaluate((el: HTMLElement) => {
            const l = el.closest("label") || el.parentElement?.querySelector("label");
            if (l) (l as HTMLElement).click();
          }).catch(() => {});
        }
        console.log(`🔘 Radio selected [${questionText.slice(0, 35)}...] -> "${optText}"`);
        break;
      }
    }
  }

  // 10. Checkbox groups
  const checkboxes = await page.locator("input[type='checkbox']:not([name='candidate.textingConsent'])").all();
  for (const cb of checkboxes) {
    const optText = await cb.evaluate((el: HTMLElement) => {
      const parentLabel = el.closest("label");
      if (parentLabel) return parentLabel.textContent || "";
      const sibling = el.parentElement?.querySelector("label");
      if (sibling) return sibling.textContent || "";
      return (el as HTMLInputElement).value || "";
    }).catch(() => "");
    const normOpt = normalizeLabel(optText);

    let check = false;
    if (normOpt.includes("node") || normOpt.includes("golang") || normOpt === "other" || normOpt.includes("c++")) {
      check = true;
    } else if (normOpt.includes("90,000") || normOpt.includes("80,000") || normOpt.includes("100,000")) {
      check = true;
    }

    if (check) {
      const isChecked = await cb.isChecked().catch(() => false);
      if (!isChecked) {
        await cb.click({ force: true }).catch(() => {});
        console.log(`☑️ Checkbox checked -> "${optText}"`);
      }
    }
  }

  // 11. Native select elements (if any)
  const selects = await page.locator("select").all();
  for (const sel of selects) {
    const label = await getAccurateLabel(sel);
    const options = await sel.evaluate((el: HTMLSelectElement) => Array.from(el.options).map(o => ({ value: o.value, text: o.text })));
    console.log(`Dropdown <select> found [${label}]: ${options.length} options`);
    if (options.length > 1) {
      // Pick first non-empty option or matching option
      const valid = options.find(o => o.value && !o.text.toLowerCase().includes("select"));
      if (valid) {
        await sel.selectOption(valid.value);
        console.log(`Selected option -> "${valid.text}"`);
      }
    }
  }

  // 12. AUDIT: Check if ANY field on the page is unfilled!
  const audit = await page.evaluate(() => {
    const form = document.querySelector("form");
    if (!form) return { error: "No form" };

    const inputs = Array.from(form.querySelectorAll("input, textarea, select"));
    const issues: any[] = [];
    let filledCount = 0;
    let totalCount = 0;

    // Check radio groups
    const radioGroups: Record<string, { radios: HTMLInputElement[]; legend: string }> = {};
    for (const r of Array.from(form.querySelectorAll("input[type='radio']")) as HTMLInputElement[]) {
      const name = r.name || "unknown";
      if (!radioGroups[name]) {
        const fs = r.closest("fieldset");
        radioGroups[name] = { radios: [], legend: fs?.querySelector("legend")?.textContent?.trim() || "" };
      }
      radioGroups[name].radios.push(r);
    }

    for (const [name, g] of Object.entries(radioGroups)) {
      totalCount++;
      const selected = g.radios.find(r => r.checked);
      if (selected) {
        filledCount++;
      } else {
        issues.push({ type: 'radio_group', name, legend: g.legend });
      }
    }

    // Check other fields
    for (const el of inputs) {
      const type = (el as HTMLInputElement).type || el.tagName.toLowerCase();
      if (type === "hidden" || type === "radio") continue;
      totalCount++;

      const val = (el as HTMLInputElement).value || "";
      const checked = (el as HTMLInputElement).checked;

      if (type === "checkbox") {
        // Not all checkboxes must be checked
        filledCount++;
      } else if (type === "file") {
        // resume / cover letter
        filledCount++;
      } else if (val.trim().length > 0) {
        filledCount++;
      } else {
        issues.push({ type, id: el.id, name: (el as HTMLInputElement).name });
      }
    }

    return { totalCount, filledCount, issues };
  });

  console.log(`\n📊 AUDIT SUMMARY FOR ${url}:`);
  console.log(`Total interactive elements: ${audit.totalCount}, Filled: ${audit.filledCount}`);
  if (audit.issues.length === 0) {
    console.log(`🎉 100% OF ALL FIELDS AND QUESTIONS FULLY ANSWERED!`);
  } else {
    console.warn(`⚠️ Unfilled fields detected:`, audit.issues);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  for (const url of RECRUITEE_JOBS) {
    const page = await context.newPage();
    try {
      await testFillFlow(page, url);
    } catch (e: any) {
      console.error(`Error filling ${url}:`, e.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
}

main().catch(console.error);
