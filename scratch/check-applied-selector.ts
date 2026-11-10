import { createPersistentBrowserContext } from "../src/browser/browser-manager";

async function checkAppliedSelector() {
  const context = await createPersistentBrowserContext(true);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  const url = "https://wellfound.com/jobs/4855345-senior-software-engineer-client-lifecycle";
  console.log("Navigating to:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const matches = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("button, span, div, [data-test]"));
    return elements
      .filter(el => {
        const text = el.textContent?.trim() || "";
        return text.includes("Applied") || text.includes("Apply");
      })
      .map(el => ({
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim().slice(0, 100),
        dataTest: el.getAttribute("data-test"),
        className: el.className
      }));
  });

  console.log("Matches containing Apply/Applied:", JSON.stringify(matches.slice(0, 20), null, 2));
  await context.close();
}

checkAppliedSelector().catch(console.error);

