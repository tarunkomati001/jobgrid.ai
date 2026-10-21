import { chromium } from "playwright";

const RECRUITEE_JOBS = [
  "https://zeromotorcycles.recruitee.com/o/functional-safety-engineer",
  "https://zeromotorcycles.recruitee.com/o/legal-counsel",
  "https://zeromotorcycles.recruitee.com/o/sales-operations-coordinator",
  "https://companiongroupltd.recruitee.com/o/senior-backend-engineer",
  "https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha",
  "https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new"
];

async function inspectAll() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  for (let i = 0; i < RECRUITEE_JOBS.length; i++) {
    const rawUrl = RECRUITEE_JOBS[i];
    const url = rawUrl.endsWith("/c/new") ? rawUrl : `${rawUrl.replace(/\/$/, "")}/c/new`;
    console.log(`\n======================================================================`);
    console.log(`Job ${i + 1}: ${url}`);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForTimeout(3000);

      // Check form
      const formExists = await page.locator("form").count();
      console.log(`Form count: ${formExists}`);
      if (formExists === 0) {
        console.log("No form found! Check if Apply button exists");
        const applyBtn = page.locator("button:has-text('Apply'), [data-cy='apply-button']").first();
        if (await applyBtn.count() > 0) {
          await applyBtn.click({ force: true });
          await page.waitForTimeout(2000);
        }
      }

      // Detailed dump of all interactive elements:
      const details = await page.evaluate(() => {
        const form = document.querySelector("form");
        if (!form) return { error: "No form" };

        const items: any[] = [];
        // Find all labels, questions, inputs, selects, buttons
        const allElements = Array.from(form.querySelectorAll("input, select, textarea, button[role='combobox'], [role='combobox'], [data-test], [id*='dropdown'], [class*='select'], [class*='Select']"));
        
        // Also look for question blocks
        const questionBlocks = Array.from(form.querySelectorAll("[class*='question'], [class*='field'], [class*='Field'], [class*='group'], [class*='Group'], div > label"));

        const inputs = Array.from(form.querySelectorAll("input, select, textarea, button"));
        for (const el of inputs) {
          const tag = el.tagName.toLowerCase();
          const type = (el as HTMLInputElement).type || "";
          const name = (el as HTMLInputElement).name || "";
          const id = el.id || "";
          const role = el.getAttribute("role") || "";
          const ariaLabel = el.getAttribute("aria-label") || "";
          const placeholder = (el as HTMLInputElement).placeholder || "";

          // find label text
          let label = "";
          if (id) {
            const l = document.querySelector(`label[for="${id}"]`);
            if (l) label = l.textContent || "";
          }
          if (!label) {
            const l = el.closest("label");
            if (l) label = l.textContent || "";
          }
          if (!label) {
            let cur = el.parentElement;
            for (let k = 0; k < 5 && cur; k++) {
              const h = cur.querySelector("label, h3, h4, h5, [class*='title'], [class*='label'], [class*='question']");
              if (h && !h.contains(el)) {
                label = h.textContent || "";
                break;
              }
              cur = cur.parentElement;
            }
          }

          items.push({
            tag,
            type,
            name,
            id,
            role,
            ariaLabel,
            placeholder,
            label: label.trim().replace(/\s+/g, " "),
            text: tag === "button" ? (el.textContent || "").trim() : undefined,
            value: (el as HTMLInputElement).value || ""
          });
        }
        return { items };
      });

      console.log(`Found ${details.items?.length || 0} items:`);
      for (const item of (details.items || [])) {
        if (item.type === "hidden") continue;
        console.log(`- [${item.tag}:${item.type}] id="${item.id}" name="${item.name}" role="${item.role}" label="${item.label}" text="${item.text || ''}" placeholder="${item.placeholder}" val="${item.value}"`);
      }

    } catch (e: any) {
      console.error(`Error inspecting ${url}:`, e.message);
    }
  }

  await browser.close();
}

inspectAll().catch(console.error);
