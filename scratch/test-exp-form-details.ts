import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const testEmail = `hrutin_inspect_exp_err_${Date.now()}@gmail.com`;
  await page.fill("input#primary-email-1", testEmail);
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']");
    if (l) (l as HTMLElement).click();
  });
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('Next')").first().click();

  // Wait for Section 1
  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForTimeout(6000);

  // Fill Sec 1
  await page.fill("input[name='firstName'], input[id*='firstName']", "Hrutin").catch(() => {});
  await page.fill("input[name='lastName'], input[id*='lastName']", "Nammi").catch(() => {});
  await page.fill("input[type='tel']", "8688423267").catch(() => {});

  // Go to Sec 2
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(5000);

  // Upload resume in Sec 2
  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  const rInput2 = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
  if (await rInput2.count() > 0) {
    await rInput2.setInputFiles(resumePath);
    await page.waitForTimeout(6000);
  }

  // Go to Sec 3
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(8000);

  // Click edit on invalid tile
  await page.evaluate(() => {
    const invalidTile = document.querySelector(".apply-flow-profile-item-tile--invalid");
    if (invalidTile) {
      const editBtn = invalidTile.querySelector(".apply-flow-profile-item-tile__edit-item-icon") as HTMLElement;
      if (editBtn) editBtn.click();
    }
  });
  await page.waitForTimeout(2000);

  // Take fullPage screenshot with the form open
  await page.screenshot({ path: "scratch/oracle_exp_edit_fullpage.png", fullPage: true });

  // Inspect buttons, error messages, and exact fields in the active form
  const formDetails = await page.evaluate(() => {
    const expBlock = Array.from(document.querySelectorAll("apply-flow-block, .apply-flow-block")).find(b => b.textContent?.toLowerCase().includes("experience"));
    const buttons = expBlock ? Array.from(expBlock.querySelectorAll("button")).map(b => ({
      id: b.id,
      text: b.textContent?.trim(),
      ariaLabel: b.getAttribute("aria-label"),
      type: b.type
    })) : [];

    const errors = expBlock ? Array.from(expBlock.querySelectorAll(".error, [class*='error'], [aria-invalid='true'], [role='alert'], .oj-message-detail")).map(e => ({
      text: e.textContent?.trim(),
      className: e.className
    })) : [];

    return { buttons, errors };
  });

  console.log("Form Details inside Experience Block:", JSON.stringify(formDetails, null, 2));

  await browser.close();
}

main().catch(console.error);
