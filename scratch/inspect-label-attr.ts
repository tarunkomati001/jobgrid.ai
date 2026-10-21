import { chromium } from "playwright";

async function inspectLabelAttr() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const res = await page.evaluate(`(() => {
    const input = document.querySelector("input[name*='7521222']");
    if (!input) return "No input";
    const parent = input.parentElement;
    const label = parent ? parent.querySelector("label") : null;
    return {
      inputId: input.id,
      inputName: input.name,
      labelFor: label ? label.getAttribute("for") : null,
      labelText: label ? label.textContent : null,
      labelHTML: label ? label.outerHTML : null
    };
  })()`);

  console.log("Salary input label check:", res);
  await browser.close();
}

inspectLabelAttr().catch(console.error);
