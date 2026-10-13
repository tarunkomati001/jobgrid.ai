import { chromium } from "playwright";

async function main() {
  const url = "https://jobs.ashbyhq.com/notion/05e14247-17c4-4e98-9a13-53828a4e2f13/application";
  console.log("🔍 Yes/No and Option Group DOM structure...");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle" });

    // Find the container for Yes/No question
    const textToFind = "We work from our offices on Mondays";
    const container = page.locator('div, fieldset, section').filter({ hasText: textToFind }).first();
    
    if (await container.count() > 0) {
      console.log("--- BEFORE CLICK ---");
      const yesBtn = container.locator("button, [role='button'], label, span, input[type='button']").filter({ hasText: /^Yes$/i }).first();
      const noBtn = container.locator("button, [role='button'], label, span, input[type='button']").filter({ hasText: /^No$/i }).first();
      
      console.log("Yes button HTML:", await yesBtn.evaluate(el => el.outerHTML));
      console.log("No button HTML:", await noBtn.evaluate(el => el.outerHTML));
      
      console.log("--- CLICKING NO ---");
      await noBtn.click();
      await page.waitForTimeout(500);

      // Run the checkSelected logic on noBtn
      const isSelected = await noBtn.evaluate((el) => {
        let curr: any = el as any;
        while (curr) {
          if (curr.classList.contains("ashby-application-form-field-entry") || curr.classList.contains("form-group")) {
            break;
          }
          const className = typeof curr.className === "string" ? curr.className : "";
          const ariaSelected = curr.getAttribute("aria-selected") || "";
          const ariaPressed = curr.getAttribute("aria-pressed") || "";
          console.log(`Evaluating tag: ${curr.tagName}, Class: ${className}, aria-pressed: ${ariaPressed}`);
          if (
            className.toLowerCase().includes("active") ||
            className.toLowerCase().includes("selected") ||
            className.toLowerCase().includes("checked") ||
            ariaSelected === "true" ||
            ariaPressed === "true"
          ) {
            return true;
          }
          curr = curr.parentElement;
        }
        return false;
      });

      console.log("checkSelected result:", isSelected);
    } else {
      console.log("Container not found.");
    }
  } catch (error) {
    console.error("Debug failed:", error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
