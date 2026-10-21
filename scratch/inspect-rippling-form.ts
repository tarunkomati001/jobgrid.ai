import { chromium } from "playwright";

async function inspectRippling() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const url = "https://ats.rippling.com/en-GB/rippling/jobs/94486f41-6474-446a-b67a-c164e11354ea";
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Click Apply now
  const applyBtn = page.locator("button:has-text('Apply now')").first();
  if (await applyBtn.count() > 0) {
    console.log("Clicking 'Apply now'...");
    await applyBtn.click();
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: "scratch/rippling_form_opened.png", fullPage: true });

  // Inspect form and all inputs
  const formData = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, textarea, select, [role='combobox'], [role='listbox'], button"));
    return inputs.map(el => {
      const tag = el.tagName.toLowerCase();
      const type = (el as HTMLInputElement).type || tag;
      const name = (el as HTMLInputElement).name || el.id;
      const id = el.id;
      const placeholder = (el as HTMLInputElement).placeholder || "";
      const ariaLabel = el.getAttribute("aria-label") || "";
      const text = (el.textContent || "").trim().slice(0, 50);

      // Label search
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
        let p = el.parentElement;
        for (let i = 0; i < 5 && p; i++) {
          const h = p.querySelector("label, [class*='label'], [class*='title'], [class*='header'], [data-qa*='label']");
          if (h && !h.contains(el)) {
            label = h.textContent || "";
            break;
          }
          p = p.parentElement;
        }
      }

      return {
        tag,
        type,
        id,
        name,
        label: label.trim().replace(/\s+/g, " "),
        placeholder,
        ariaLabel,
        text,
        classes: el.className
      };
    }).filter(x => x.type !== "hidden" && (x.label || x.name || x.placeholder || x.ariaLabel || x.tag === "button"));
  });

  console.log(`\nFound ${formData.length} interactive elements on Rippling:`);
  for (const item of formData) {
    console.log(`- [${item.tag}/${item.type}] id="${item.id}" name="${item.name}" label="${item.label}" placeholder="${item.placeholder}" aria="${item.ariaLabel}" text="${item.text}"`);
  }

  await browser.close();
}

inspectRippling().catch(console.error);
