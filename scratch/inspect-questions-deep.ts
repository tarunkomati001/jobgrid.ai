import { chromium } from "playwright";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344708/?keyword=software+engineer&mode=location";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log("Navigating to Job 2:", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.fill("hrutin_deep_q@gmail.com");

  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const l = document.querySelector("label[for='legal-disclaimer-checkbox']");
      if (l) (l as HTMLElement).click();
      else cb.click();
    }
  });
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('Next')").first().click();

  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForTimeout(5000);

  // Extract all questions with their labels and child inputs/buttons
  const questions = await page.evaluate(() => {
    const blocks = Array.from(document.querySelectorAll(".input-row, .form-block, [class*='question'], [class*='field-container'], section"));
    return blocks.map(b => {
      const label = b.querySelector("label, .label, legend, span.title, .input-row__label")?.textContent?.trim() || "";
      const text = b.textContent?.trim().slice(0, 150) || "";
      const inputs = Array.from(b.querySelectorAll("input, select, button[role='radio'], [role='combobox']")).map(el => {
        const inp = el as any;
        return {
          tag: el.tagName.toLowerCase(),
          id: inp.id,
          name: inp.name,
          type: inp.type,
          role: el.getAttribute("role"),
          value: inp.value,
          text: el.textContent?.trim(),
          ariaLabel: el.getAttribute("aria-label")
        };
      });
      return { label, text, inputs };
    }).filter(q => q.inputs.length > 0);
  });

  console.log("Extracted Questions Count:", questions.length);
  for (let i = 0; i < questions.length; i++) {
    console.log(`\nQ${i + 1}: Label="${questions[i].label}"`);
    console.log(`Summary: ${questions[i].text.slice(0, 80)}`);
    console.log(`Inputs:`, JSON.stringify(questions[i].inputs));
  }

  // Also check all dropdown options available by inspecting Knockout / JET data or toggle buttons
  const dropdownToggles = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button[id*='toggle']"));
    return buttons.map(b => ({
      id: b.id,
      ariaLabel: b.getAttribute("aria-label"),
      title: b.getAttribute("title")
    }));
  });
  console.log("\nDropdown toggle buttons:", dropdownToggles);

  await browser.close();
}

main().catch(console.error);
