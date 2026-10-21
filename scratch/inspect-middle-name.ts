import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5008";
  await page.goto(url, { waitUntil: "networkidle" });

  const applyBtn = page.locator("a:has-text('Apply Now'), button:has-text('Apply Now')").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click();
    await page.waitForTimeout(3000);
  }

  // Login
  if (await page.locator("input[name='email']").count() > 0) {
    await page.fill("input[name='email']", "babufakemail@gmail.com");
    await page.fill("input[name='cwsPassword']", "Tarun@2006");
    await page.fill("input[name='cwsPassword_2']", "Tarun@2006");
    await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
    await page.waitForTimeout(3000);
  }

  if (page.url().includes("candidateLogin")) {
    await page.fill("input[name='cwsPassword']", "Tarun@2006");
    await page.locator("button[name='login'], button:has-text('Login')").first().click();
    await page.waitForTimeout(4000);
  }

  // Dump all input/select/textarea on Step 1
  const fields = await page.evaluate(() => {
    const active = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active") || document;
    const inputs = Array.from(active.querySelectorAll("input, select, textarea"));
    return inputs.map((el: any) => {
      let label = "";
      if (el.id) {
        const l = document.querySelector(`label[for='${el.id}']`);
        if (l) label = l.textContent?.trim() || "";
      }
      if (!label) {
        const parent = el.closest(".form-group, tr, td, div");
        if (parent) {
          const l = parent.querySelector("label, .control-label");
          if (l) label = l.textContent?.trim() || "";
        }
      }
      return {
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        label,
        value: el.value,
        required: el.required || el.getAttribute("aria-required") === "true" || !!el.closest(".required, [class*='required']"),
        classes: el.className
      };
    });
  });

  console.log("FIELDS ON STEP 1:", JSON.stringify(fields, null, 2));

  await browser.close();
}

main().catch(console.error);
