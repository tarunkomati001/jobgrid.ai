import { chromium } from "playwright";
import { UserProfile } from "../src/ats/ats.interface";
import { normalizeLabel } from "../src/application/field-mapper";
import { suggestAnswerForQuestion } from "../src/application/question-answering";

const RECRUITEE_JOBS = [
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
  const targetUrl = url.endsWith("/c/new") ? url : `${url.replace(/\/$/, "")}/c/new`;
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
  await page.waitForTimeout(2000);

  // Radio groups
  const radioInputs = await page.locator("input[type='radio']").all();
  const radioGroups: Record<string, any[]> = {};
  for (const r of radioInputs) {
    const name = (await r.getAttribute("name").catch(() => "")) || "unknown";
    if (!radioGroups[name]) radioGroups[name] = [];
    radioGroups[name].push(r);
  }

  for (const [name, radios] of Object.entries(radioGroups)) {
    if (radios.length === 0) continue;

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

    // Read all options in this group first
    const optionsInfo: { r: any; optText: string; normOpt: string }[] = [];
    for (const r of radios) {
      const optText = await r.evaluate((el: HTMLElement) => {
        const parentLabel = el.closest("label");
        if (parentLabel) return parentLabel.textContent || "";
        const sibling = el.parentElement?.querySelector("label");
        if (sibling) return sibling.textContent || "";
        return (el as HTMLInputElement).value || "";
      }).catch(() => "");
      optionsInfo.push({ r, optText, normOpt: normalizeLabel(optText) });
    }

    let selectedOption: any = null;

    // Rule 1: Statement acknowledgement (e.g. "Important Work Authorization Information... Do you understand?")
    const ackOpt = optionsInfo.find(o => o.normOpt.includes("understand") || o.normOpt.includes("agree"));
    if (ackOpt && (normQ.includes("statement") || normQ.includes("information") || normQ.includes("understand"))) {
      selectedOption = ackOpt;
    }

    // Rule 2: Right to work / Authorization
    if (!selectedOption && (normQ.includes("right to work") || normQ.includes("legal right") || normQ.includes("authorized") || normQ.includes("legally authorized"))) {
      selectedOption = optionsInfo.find(o =>
        o.normOpt.includes("valid work visa") ||
        o.normOpt.includes("critical skills") ||
        o.normOpt.includes("permanent resident") ||
        o.normOpt.includes("citizen") ||
        o.normOpt === "yes" ||
        o.normOpt.includes("authorized")
      );
    }

    // Rule 3: Sponsorship requirement: "Do you require sponsorship", "Will you now or in the future require visa sponsorship"
    if (!selectedOption && (normQ.includes("require sponsorship") || normQ.includes("require visa") || (normQ.includes("sponsorship") && !normQ.includes("without")))) {
      selectedOption = optionsInfo.find(o => o.normOpt === "no" || o.normOpt.includes("not require"));
    }

    // Rule 4: State of residence
    if (!selectedOption && (normQ.includes("state") || normQ.includes("territory") || normQ.includes("residence"))) {
      selectedOption = optionsInfo.find(o => o.normOpt === "california" || o.normOpt.includes("california"));
    }

    // Rule 5: Gender
    if (!selectedOption && normQ.includes("gender")) {
      selectedOption = optionsInfo.find(o => o.normOpt === "male");
    }

    // Rule 6: Race / Ethnicity
    if (!selectedOption && (normQ.includes("race") || normQ.includes("population") || normQ.includes("ethnic"))) {
      selectedOption = optionsInfo.find(o => o.normOpt.includes("indian") || o.normOpt.includes("asian"));
    }

    // Rule 7: Experience
    if (!selectedOption && (normQ.includes("years") || normQ.includes("experience"))) {
      selectedOption = optionsInfo.find(o => o.normOpt.includes("3 to 6") || o.normOpt.includes("3-6") || o.normOpt.includes("6+") || o.normOpt === "yes");
    }

    // Rule 8: Criminal background check / Assessment
    if (!selectedOption && (normQ.includes("background check") || normQ.includes("assessment") || normQ.includes("cognitive") || normQ.includes("evaluation"))) {
      selectedOption = optionsInfo.find(o => o.normOpt === "yes" || o.normOpt.includes("understand"));
    }

    // Rule 9: General Yes/No fallback -> Yes
    if (!selectedOption) {
      selectedOption = optionsInfo.find(o => o.normOpt === "yes");
    }

    if (selectedOption) {
      await selectedOption.r.click({ force: true }).catch(() => {});
      const checked = await selectedOption.r.isChecked().catch(() => false);
      if (!checked) {
        await selectedOption.r.evaluate((el: HTMLElement) => {
          const l = el.closest("label") || el.parentElement?.querySelector("label");
          if (l) (l as HTMLElement).click();
        }).catch(() => {});
      }
      console.log(`🔘 Radio selected [${questionText.slice(0, 40)}...] -> "${selectedOption.optText}"`);
    } else {
      console.warn(`❌ No matching radio option found for: "${questionText}"`);
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  for (const url of RECRUITEE_JOBS) {
    const page = await browser.newPage();
    console.log(`\n======================================================`);
    console.log(`Testing radio rules on: ${url}`);
    await testFillFlow(page, url);
    await page.close();
  }
  await browser.close();
}

main().catch(console.error);
