import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function testTaleoFlow() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742";
  console.log(`Opening ${url}...`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  // 1. Step 1: Fill credentials
  console.log("Filling Step 1 credentials...");
  await page.fill("#email", "babufakemail@gmail.com");
  await page.fill("#cwsPassword", "u9m!LLvdS7Bcyqc");
  await page.fill("#cwsPassword_2", "u9m!LLvdS7Bcyqc");
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.resolve(__dirname, "taleo_step1_filled.png") });

  // Click Next
  console.log("Clicking Next arrow...");
  const nextBtn = page.locator(".oracletaleocwsv2-arrow-nav-next").first();
  await nextBtn.click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.resolve(__dirname, "taleo_after_step1_next.png") });

  // Check active step and error messages if any
  const currentStep = await page.evaluate(() => {
    const active = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
    const errors = Array.from(document.querySelectorAll(".oracletaleocwsv2-error-text, .text-danger, .alert-danger")).map(e => e.textContent?.trim()).filter(Boolean);
    return {
      activeId: active ? active.id : null,
      activeTitle: active ? active.querySelector(".title")?.textContent?.trim() : null,
      errors
    };
  });

  console.log("Current state after Step 1 Next:", JSON.stringify(currentStep, null, 2));

  // If we are on step-02 or if there's any dialog / alert
  if (currentStep.activeId === "step-02") {
    console.log("🎉 Successfully moved to Step 2: Your Information!");
    
    // Check all fields present in step-02
    const step2Fields = await page.evaluate(() => {
      const s2 = document.getElementById("step-02");
      if (!s2) return [];
      return Array.from(s2.querySelectorAll("input, select, textarea")).map(el => {
        const inp = el as any;
        return {
          tag: inp.tagName,
          type: inp.type,
          id: inp.id,
          name: inp.name,
          value: inp.value,
          disabled: inp.disabled,
          readOnly: inp.readOnly
        };
      });
    });
    console.log("Step 2 fields:", JSON.stringify(step2Fields, null, 2));
  }

  await page.waitForTimeout(5000);
  await browser.close();
}

testTaleoFlow().catch(console.error);
