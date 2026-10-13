import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const testEmail = `hrutin_inspect_tiles_${Date.now()}@gmail.com`;
  console.log("Navigating to Oracle email step...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1", testEmail);
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']") as HTMLElement;
    if (l) l.click();
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim().toLowerCase() === "next");
    if (btn) btn.click();
  });

  // Wait for Section 1
  for (let s = 1; s <= 20; s++) {
    await page.waitForTimeout(1000);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForSelector("input[name='firstName'], input.phone-row__input", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Fill Sec 1
  await page.fill("input[name='firstName'], input[id*='firstName']", "Hrutin").catch(() => {});
  await page.fill("input[name='lastName'], input[id*='lastName']", "Nammi").catch(() => {});
  await page.fill("input[type='tel']", "4155552671").catch(() => {});

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

  // Dump ALL tiles and blocks on Section 3!
  const section3Structure = await page.evaluate(() => {
    const blocks = Array.from(document.querySelectorAll("apply-flow-block, .apply-flow-block"));
    return blocks.map(b => {
      const title = b.querySelector(".apply-flow-block__title, h2, h3")?.textContent?.trim() || "";
      const tiles = Array.from(b.querySelectorAll(".apply-flow-profile-item-tile")).map(t => {
        const summaryTitle = t.querySelector(".apply-flow-profile-item-tile__summary-title")?.textContent?.trim() || "";
        const subtitle = t.querySelector(".apply-flow-profile-item-tile__summary-subtitle")?.textContent?.trim() || "";
        const validation = t.querySelector(".apply-flow-profile-item-tile__summary-validation")?.textContent?.trim() || "";
        const isInvalid = t.classList.contains("apply-flow-profile-item-tile--invalid") || t.getAttribute("data-profile-item-invalid") === "true";
        return {
          summaryTitle,
          subtitle,
          validation,
          isInvalid,
          id: t.id
        };
      });
      return { title, tileCount: tiles.length, tiles };
    });
  });

  console.log("=== SECTION 3 BLOCKS & TILES ===");
  console.log(JSON.stringify(section3Structure, null, 2));

  await browser.close();
}

main().catch(console.error);
