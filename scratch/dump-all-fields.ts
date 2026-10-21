import { chromium } from "playwright";

async function dumpAllFields() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const urls = [
    "https://zeromotorcycles.recruitee.com/o/functional-safety-engineer",
    "https://zeromotorcycles.recruitee.com/o/legal-counsel",
    "https://zeromotorcycles.recruitee.com/o/sales-operations-coordinator",
    "https://companiongroupltd.recruitee.com/o/senior-backend-engineer",
    "https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha",
    "https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new"
  ];

  for (const rawUrl of urls) {
    const url = rawUrl.endsWith("/c/new") ? rawUrl : `${rawUrl.replace(/\/$/, "")}/c/new`;
    console.log(`\n===============================================================`);
    console.log(`JOB FORM: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
      const items: any[] = [];
      const form = document.querySelector("form");
      if (!form) return [{ error: "No form" }];

      // Find all question sections
      // In Recruitee, fields are wrapped in form-group or styled divs
      const inputs = Array.from(form.querySelectorAll("input, textarea, select"));
      for (const input of inputs) {
        const name = (input as HTMLInputElement).name;
        const type = (input as HTMLInputElement).type;
        const id = input.id;
        if (type === "hidden") continue;

        // Find label
        let label = "";
        if (id) {
          const l = document.querySelector(`label[for="${id}"]`);
          if (l) label = l.textContent || "";
        }
        if (!label) {
          const l = input.closest("label");
          if (l) label = l.textContent || "";
        }
        if (!label) {
          let p = input.parentElement;
          for (let i = 0; i < 5 && p; i++) {
            const h = p.querySelector("label, h3, h4, [class*='title'], [class*='label'], [class*='question']");
            if (h && h !== input) {
              label = h.textContent || "";
              break;
            }
            p = p.parentElement;
          }
        }

        // For radio or checkbox, find option text
        let optionLabel = "";
        const optContainer = input.closest("label, [class*='radio'], [class*='checkbox']");
        if (optContainer) {
          optionLabel = optContainer.textContent?.trim() || "";
        }

        items.push({
          name,
          type,
          id,
          label: label.trim().replace(/\s+/g, " "),
          optionLabel: optionLabel.trim().replace(/\s+/g, " ")
        });
      }
      return items;
    });

    for (const d of data) {
      console.log(`- [${d.type}] Name: ${d.name} | Label: "${d.label}" | Option: "${d.optionLabel}"`);
    }
  }

  await browser.close();
}

dumpAllFields().catch(console.error);
