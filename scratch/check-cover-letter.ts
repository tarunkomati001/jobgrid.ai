import { chromium } from "playwright";

async function checkCoverLetter() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const urls = [
    "https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new",
    "https://zeromotorcycles.recruitee.com/o/legal-counsel/c/new",
    "https://zeromotorcycles.recruitee.com/o/sales-operations-coordinator/c/new",
    "https://companiongroupltd.recruitee.com/o/senior-backend-engineer/c/new",
    "https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha/c/new",
    "https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new"
  ];

  for (const url of urls) {
    console.log("\n=======================================================");
    console.log("Checking cover letter on:", url);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const clInfo = await page.evaluate(() => {
      // Find all elements containing cover letter
      const allMatches = Array.from(document.querySelectorAll("*")).filter(el => {
        const text = (el.textContent || "").toLowerCase();
        const name = (el.getAttribute("name") || "").toLowerCase();
        const id = (el.id || "").toLowerCase();
        return (name.includes("coverletter") || id.includes("coverletter") || (el.tagName === "LABEL" && text.includes("cover letter")));
      });

      // Find file inputs
      const fileInputs = Array.from(document.querySelectorAll("input[type='file']")).map(f => ({
        id: f.id,
        name: (f as HTMLInputElement).name,
        accept: (f as HTMLInputElement).accept
      }));

      // Find buttons around cover letter
      const clSection = document.querySelector("[name*='coverLetter'], [id*='coverLetter']")?.closest("[class*='sc-'], .field, div");
      const buttons = clSection ? Array.from(clSection.querySelectorAll("button, a")).map(b => b.textContent?.trim()) : [];
      const textareas = clSection ? Array.from(clSection.querySelectorAll("textarea")).map(t => ({ id: t.id, name: t.name })) : [];

      return {
        fileInputs,
        clSectionButtons: buttons,
        clSectionTextareas: textareas,
        matches: allMatches.slice(0, 5).map(m => ({ tag: m.tagName, id: m.id, class: m.className, text: m.textContent?.slice(0, 60) }))
      };
    });

    console.log("Cover Letter Info:", JSON.stringify(clInfo, null, 2));
  }

  await browser.close();
}

checkCoverLetter().catch(console.error);
