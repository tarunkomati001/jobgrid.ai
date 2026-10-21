import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://ats.rippling.com/en-GB/rippling/jobs/f255bf03-9173-4c0a-8a18-7cc43c27ded8";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const applyBtn = page.locator("button:has-text('Apply now')").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click();
    await page.waitForTimeout(2000);
  }

  const allText = await page.evaluate(() => {
    const fields = Array.from(document.querySelectorAll("div[data-testid='field']"));
    return fields.map((f, i) => {
      let title = "";
      let el: any = f;
      while (el && el.tagName !== "FORM") {
        if (el.previousElementSibling) {
          title = el.previousElementSibling.textContent || "";
          if (title.length > 5) break;
        }
        el = el.parentElement;
      }
      return {
        i,
        label: f.querySelector("label, span[id$='-label']")?.textContent || "",
        title: title.slice(0, 100),
        htmlSnippet: f.innerHTML.slice(0, 150)
      };
    });
  });

  console.log("Fields breakdown:", JSON.stringify(allText, null, 2));
  await browser.close();
}

main().catch(console.error);
