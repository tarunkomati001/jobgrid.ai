import { chromium } from "playwright";

async function checkSubmitButton() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const submitButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button[type='submit'], input[type='submit'], button")).filter(b => {
      const text = (b.textContent || "").toLowerCase();
      const type = b.getAttribute("type") || "";
      return type === "submit" || text.includes("send") || text.includes("submit") || text.includes("apply");
    }).map(b => ({
      tag: b.tagName,
      type: b.getAttribute("type"),
      id: b.id,
      text: b.textContent?.trim(),
      class: b.className
    }));
  });

  console.log("Submit buttons found:", submitButtons);
  await browser.close();
}

checkSubmitButton().catch(console.error);
