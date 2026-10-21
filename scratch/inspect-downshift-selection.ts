import { chromium } from "playwright";

async function testSelectUSInDownshift() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const countryBtn = page.locator("button[id*='country-select'], button[aria-label*='Select country calling code']").first();
  console.log("Initial country:", await countryBtn.innerText());

  // Click country button
  await countryBtn.click();
  await page.waitForTimeout(500);

  // How does Downshift know its items?
  // Let's inspect react fiber or internal props on countryBtn or menu!
  const fiberInfo = await page.evaluate(() => {
    const btn = document.querySelector("button[id*='country-select']");
    if (!btn) return "No button";

    // Check react fiber
    const key = Object.keys(btn).find(k => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
    let fiber = key ? (btn as any)[key] : null;

    // Search parents for downshift props or country list
    let countriesFound: any = null;
    let cur = fiber;
    while (cur && !countriesFound) {
      if (cur.memoizedProps?.items) {
        countriesFound = cur.memoizedProps.items;
      }
      cur = cur.return;
    }

    return {
      hasFiber: !!fiber,
      countriesCount: countriesFound ? countriesFound.length : 0,
      sample: countriesFound ? countriesFound.slice(0, 5) : null
    };
  });

  console.log("Fiber info:", fiberInfo);

  // Let's see how keyboard navigation works in the listbox:
  // When menu is open, if you press ArrowDown or PageDown or type keys
  console.log("Testing typing 'United States' or ArrowDown...");
  // Let's test typing 'United States'
  await page.keyboard.type("United States");
  await page.waitForTimeout(500);

  const currentHighlight = await page.evaluate(() => {
    const highlighted = document.querySelector("[aria-selected='true'], [class*='highlighted'], [class*='selected']");
    return highlighted ? { text: highlighted.textContent, id: highlighted.id } : null;
  });
  console.log("Highlighted after typing:", currentHighlight);

  await browser.close();
}

testSelectUSInDownshift().catch(console.error);
