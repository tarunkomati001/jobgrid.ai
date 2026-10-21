import { chromium } from "playwright";

const RECRUITEE_JOBS = [
  "https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new",
  "https://zeromotorcycles.recruitee.com/o/legal-counsel/c/new",
  "https://zeromotorcycles.recruitee.com/o/sales-operations-coordinator/c/new",
  "https://companiongroupltd.recruitee.com/o/senior-backend-engineer/c/new",
  "https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha/c/new",
  "https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new"
];

async function inspectQuestions() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (let idx = 0; idx < RECRUITEE_JOBS.length; idx++) {
    const url = RECRUITEE_JOBS[idx];
    console.log(`\n======================================================`);
    console.log(`Inspecting Job ${idx + 1}: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const questions = await page.evaluate(() => {
      const qElements: any[] = [];
      // Recruitee wraps fields in divs
      // Let's find every open question input/radio/checkbox/select/textarea
      const allInputs = Array.from(document.querySelectorAll("input, textarea, select, button[aria-haspopup='listbox']"));
      for (const el of allInputs) {
        const name = (el as HTMLInputElement).name || el.id;
        if (!name || name.startsWith("candidate.name") || name.startsWith("candidate.email") || name.startsWith("candidate.phone") || name.startsWith("candidate.cv") || name.startsWith("candidate.coverLetterFile")) {
          continue;
        }
        const type = (el as HTMLInputElement).type || el.tagName.toLowerCase();
        if (type === "hidden") continue;

        // Traverse up to find container and question text
        let questionText = "";
        let cur = el.parentElement;
        let containerHTML = "";
        for (let step = 0; step < 7 && cur; step++) {
          const title = cur.querySelector("h3, h4, h5, [class*='title'], [class*='question'], [class*='Label'], [class*='legend'], legend");
          if (title && !title.contains(el)) {
            questionText = title.textContent || "";
            containerHTML = cur.outerHTML.slice(0, 300);
            break;
          }
          // also check previous sibling
          if (cur.previousElementSibling && !questionText) {
            const prevText = cur.previousElementSibling.textContent || "";
            if (prevText.length > 5 && prevText.length < 200) {
              questionText = prevText;
            }
          }
          cur = cur.parentElement;
        }

        // Parent label text
        const parentLabel = el.closest("label")?.textContent?.trim() || "";

        qElements.push({
          name,
          id: el.id,
          type,
          tag: el.tagName,
          questionText: questionText.trim().replace(/\s+/g, " "),
          parentLabel,
          value: (el as HTMLInputElement).value || ""
        });
      }
      return qElements;
    });

    console.log(`Found ${questions.length} questions:`);
    for (const q of questions) {
      console.log(`- [${q.type}] name="${q.name}" label="${q.parentLabel}" question="${q.questionText}" val="${q.value}"`);
    }
  }

  await browser.close();
}

inspectQuestions().catch(console.error);
