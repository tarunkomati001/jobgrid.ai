import { chromium } from "playwright";

async function inspectWhy() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const res = await page.evaluate(() => {
    const title = document.querySelector("#cookie-dialog-title");
    const parentDialog = title?.closest("[role='dialog']");
    const btns = Array.from(document.querySelectorAll("button")).map(b => ({
      text: b.textContent,
      dataCy: b.getAttribute("data-cy"),
      dataTestId: b.getAttribute("data-testid")
    }));
    return {
      hasTitle: !!title,
      hasParentDialog: !!parentDialog,
      dialogOuterHTML: parentDialog ? parentDialog.outerHTML.slice(0, 500) : null,
      parentOfDialog: parentDialog?.parentElement?.tagName,
      btns
    };
  });

  console.log("Details:", JSON.stringify(res, null, 2));
  await browser.close();
}

inspectWhy().catch(console.error);
