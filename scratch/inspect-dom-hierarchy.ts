import { chromium } from "playwright";

async function inspectHierarchy() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const salaryHierarchy = await page.evaluate(() => {
    const el = document.querySelector("input[name*='7521222']");
    if (!el) return null;
    const lineage: any[] = [];
    let cur = el as HTMLElement | null;
    while (cur && cur.tagName !== "FORM") {
      const childrenText = Array.from(cur.children).map(c => ({
        tag: c.tagName,
        className: c.className,
        text: (c.textContent || "").slice(0, 50).trim()
      }));
      lineage.push({
        tag: cur.tagName,
        className: cur.className,
        id: cur.id,
        childrenCount: cur.children.length,
        childrenSummary: childrenText
      });
      cur = cur.parentElement;
    }
    return lineage;
  });

  console.log("Salary input lineage:", JSON.stringify(salaryHierarchy, null, 2));

  await browser.close();
}

inspectHierarchy().catch(console.error);
