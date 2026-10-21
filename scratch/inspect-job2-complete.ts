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

  console.log("Current URL:", page.url());
  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.fill("hrutin_audit_j2@gmail.com");

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

  console.log("Reached URL:", page.url());

  // Dump all interactive elements on Section 1
  const sec1Fields = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea, button[role='radio'], [role='combobox']"));
    return els.map(el => {
      const inp = el as any;
      let label = "";
      if (inp.id) {
        const l = document.querySelector("label[for='" + inp.id + "']");
        if (l) label = l.textContent?.trim() || "";
      }
      if (!label && inp.labels && inp.labels.length > 0) {
        label = Array.from(inp.labels).map((x: any) => x.textContent?.trim()).join(" ");
      }
      if (!label) {
        const p = inp.closest(".form-block, .field, div, section, p, label");
        if (p) {
          const l = p.querySelector("label, span.label, span.title, p");
          if (l) label = l.textContent?.trim() || "";
        }
      }
      return {
        tag: el.tagName.toLowerCase(),
        id: inp.id || null,
        name: inp.name || null,
        type: inp.type || null,
        role: el.getAttribute("role") || null,
        label: label.replace(/\s+/g, " "),
        ariaLabel: el.getAttribute("aria-label") || null,
        value: inp.value !== undefined ? inp.value : null,
        placeholder: inp.placeholder || null,
        required: inp.required || el.getAttribute("aria-required") === "true"
      };
    });
  });

  console.log("Section 1 Elements Count:", sec1Fields.length);
  console.log("Section 1 Elements:", JSON.stringify(sec1Fields, null, 2));

  await browser.close();
}

main().catch(console.error);
