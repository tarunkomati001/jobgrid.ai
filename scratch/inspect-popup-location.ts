import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344708/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.fill("input#primary-email-1", "check_popup@gmail.com");
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']") as HTMLElement;
    if (l) l.click();
  });
  await page.click("button:has-text('Next')");
  await page.waitForTimeout(6000);

  // Take screenshot before clicking Gender
  console.log("Looking for Gender elements...");
  const genderData = await page.evaluate(() => {
    const inp = document.querySelector("input[name*='GENDER'], input[id*='GENDER']") as HTMLInputElement;
    const btn = document.querySelector("button[id*='GENDER'][id*='toggle']") as HTMLButtonElement;
    return {
      inpId: inp?.id,
      inpName: inp?.name,
      inpAriaControls: inp?.getAttribute("aria-controls"),
      btnId: btn?.id,
      btnAriaControls: btn?.getAttribute("aria-controls"),
      btnRect: btn?.getBoundingClientRect()
    };
  });
  console.log("Gender elements data:", genderData);

  // Scroll to Gender button and click it with Playwright mouse
  if (genderData.btnId) {
    const btn = page.locator(`#${genderData.btnId}`);
    await btn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await btn.click({ force: true });
    await page.waitForTimeout(1000);

    const afterClick = await page.evaluate((controlsId) => {
      const target = controlsId ? document.getElementById(controlsId) : null;
      const allPopups = Array.from(document.querySelectorAll(".cx-select__list-item, .oj-listbox-results, [role='listbox'], [role='option'], .cx-select-popup"));
      return {
        targetFound: !!target,
        targetHtml: target ? target.outerHTML.slice(0, 300) : null,
        popupElements: allPopups.map(p => ({
          tag: p.tagName,
          id: p.id,
          className: p.className,
          text: p.textContent?.trim().slice(0, 50)
        }))
      };
    }, genderData.btnAriaControls);

    console.log("After click inspection:", JSON.stringify(afterClick, null, 2));
  }

  await browser.close();
}

main().catch(console.error);
