import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/347172/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const testEmail = `hrutin_exp_check_${Date.now()}@gmail.com`;
  await page.fill("input#primary-email-1", testEmail);
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']") as HTMLElement;
    if (l) l.click();
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim().toLowerCase() === "next");
    if (btn) btn.click();
  });

  for (let s = 1; s <= 20; s++) {
    await page.waitForTimeout(1000);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForTimeout(4000);

  // Upload resume
  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  const fileInp = page.locator("input[type='file']").first();
  await fileInp.setInputFiles(resumePath);
  console.log("Uploaded resume, waiting 10s for parse...");
  await page.waitForTimeout(10000);

  // Click edit on experience tile
  const expBlock = await page.evaluate(() => {
    const tile = document.querySelector(".apply-flow-profile-item-tile--invalid, .apply-flow-profile-item-tile");
    const editBtn = tile?.querySelector(".apply-flow-profile-item-tile__edit-item-icon, button[title='Edit']") as HTMLElement;
    if (editBtn) {
      editBtn.click();
      return true;
    }
    return false;
  });
  console.log("Clicked edit on tile:", expBlock);
  await page.waitForTimeout(2000);

  // Dump all inputs inside the open form
  const inputs = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("input, select, textarea, button[id*='toggle']"));
    return els.map(e => ({
      id: e.id,
      name: (e as any).name,
      type: (e as any).type,
      value: (e as any).value,
      checked: (e as any).checked,
      ariaLabel: e.getAttribute("aria-label"),
      text: e.textContent?.trim()
    })).filter(x => x.id || x.name || x.ariaLabel);
  });

  console.log("Inputs inside opened form:", JSON.stringify(inputs, null, 2));
  await browser.close();
}

main().catch(console.error);
