import { chromium } from "playwright";
import dotenv from "dotenv";
import tls from "tls";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";

// Helper to poll for a brand new Oracle OTP that arrived after minTimestamp or with ID > knownLatestId
async function pollNewOracleOtp(
  knownLatestId: number,
  timeoutMs: number = 60000
): Promise<string | null> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) return null;

  console.log(`📡 [Gmail OTP Listener] Polling Gmail for fresh verification email (must be newer than ID ${knownLatestId})...`);
  const startTime = Date.now();

  const checkOnce = (): Promise<{ id: number; code: string } | null> => {
    return new Promise((resolve) => {
      const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
      socket.setEncoding("utf8");

      let buffer = "";
      let step = 0;

      const finish = (res: { id: number; code: string } | null) => {
        try {
          socket.write("a999 LOGOUT\r\n");
          socket.end();
        } catch (e) {}
        resolve(res);
      };

      socket.on("data", (chunk: string) => {
        buffer += chunk;
        if (step === 0 && buffer.includes("* OK")) {
          step = 1;
          buffer = "";
          socket.write(`a001 LOGIN ${user} ${pass}\r\n`);
        } else if (step === 1 && buffer.includes("a001 OK")) {
          step = 2;
          buffer = "";
          socket.write(`a002 SELECT INBOX\r\n`);
        } else if (step === 2 && buffer.includes("a002 OK")) {
          step = 3;
          buffer = "";
          socket.write(`a003 SEARCH TEXT "Oracle"\r\n`);
        } else if (step === 3 && buffer.includes("a003 OK")) {
          const match = buffer.match(/\* SEARCH (.*)\r\n/);
          const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean).map(Number) : [];
          if (ids.length === 0) {
            finish(null);
            return;
          }
          const latestId = ids[ids.length - 1];
          if (latestId <= knownLatestId) {
            // No newer email yet! Hold!
            finish(null);
            return;
          }
          // Newer email found! Fetch body
          step = 4;
          buffer = "";
          socket.write(`a004 FETCH ${latestId} (INTERNALDATE BODY[TEXT])\r\n`);
        } else if (step === 4 && buffer.includes("a004 OK")) {
          const otpMatch = buffer.match(/(?:pass\s*code|verification\s*code|one-time\s*code|code)[:\s*]+([0-9]{6})/i);
          if (otpMatch && otpMatch[1]) {
            finish({ id: knownLatestId + 1, code: otpMatch[1] });
            return;
          }
          finish(null);
        } else if (buffer.includes("NO") || buffer.includes("BAD")) {
          finish(null);
        }
      });

      socket.on("error", () => finish(null));
      setTimeout(() => finish(null), 8000);
    });
  };

  while (Date.now() - startTime < timeoutMs) {
    const res = await checkOnce();
    if (res && res.code) {
      console.log(`🎉 [Gmail OTP Listener] Verified fresh code received: ${res.code}`);
      return res.code;
    }
    console.log("⏳ [Gmail OTP Listener] Waiting for new Oracle verification email to arrive...");
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

// Helper to get current latest Oracle email ID before triggering Next
async function getLatestOracleEmailId(): Promise<number> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) return 0;

  return new Promise((resolve) => {
    const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
    socket.setEncoding("utf8");
    let buffer = "";
    let step = 0;

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (step === 0 && buffer.includes("* OK")) {
        step = 1;
        buffer = "";
        socket.write(`a001 LOGIN ${user} ${pass}\r\n`);
      } else if (step === 1 && buffer.includes("a001 OK")) {
        step = 2;
        buffer = "";
        socket.write(`a002 SELECT INBOX\r\n`);
      } else if (step === 2 && buffer.includes("a002 OK")) {
        step = 3;
        buffer = "";
        socket.write(`a003 SEARCH TEXT "Oracle"\r\n`);
      } else if (step === 3 && buffer.includes("a003 OK")) {
        const match = buffer.match(/\* SEARCH (.*)\r\n/);
        const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean).map(Number) : [];
        const latestId = ids.length > 0 ? ids[ids.length - 1] : 0;
        socket.write("a999 LOGOUT\r\n");
        socket.end();
        resolve(latestId);
      }
    });

    socket.on("error", () => resolve(0));
    setTimeout(() => {
      socket.end();
      resolve(0);
    }, 8000);
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log("Navigating to Oracle apply URL:", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.waitFor({ state: "visible", timeout: 10000 });

  // 1. Get latest email ID in Gmail before requesting a new code
  console.log("Checking current highest email ID in Gmail inbox...");
  const baselineId = await getLatestOracleEmailId();
  console.log(`Current baseline Oracle email ID: ${baselineId}`);

  // 2. Submit Email
  console.log("Entering email babufakemail@gmail.com...");
  await emailInput.fill("babufakemail@gmail.com");

  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
      if (label) label.click();
      else cb.click();
    }
  });
  await page.waitForTimeout(1000);

  console.log("Clicking Next...");
  const nextBtn = page.locator("button:has-text('Next')").first();
  await nextBtn.click();
  await page.waitForTimeout(4000);

  // 3. Wait for OTP screen
  console.log("Checking for OTP screen...");
  await page.waitForSelector("#pin-code-1", { state: "visible", timeout: 15000 });
  console.log("✅ Identity confirmation screen active!");

  // 4. Poll Gmail for the freshly sent OTP (holding until it arrives)
  const freshOtp = await pollNewOracleOtp(baselineId, 60000);
  if (!freshOtp) {
    throw new Error("Failed to retrieve fresh OTP from Gmail within timeout");
  }

  // 5. Paste the fresh OTP into #pin-code-1
  console.log(`Pasting fresh OTP: ${freshOtp} into #pin-code-1...`);
  const pasted = await page.evaluate((code) => {
    const el = document.getElementById("pin-code-1");
    if (!el) return false;
    const dt = new DataTransfer();
    dt.setData("text/plain", code);
    const pasteEvent = new ClipboardEvent("paste", {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    });
    el.focus();
    el.dispatchEvent(pasteEvent);
    return true;
  }, freshOtp);
  console.log("Pasted status:", pasted);

  await page.waitForTimeout(1000);

  // Verify all 6 segments received the digits
  const pinValues = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input[id^='pin-code-']")).map((i: any) => i.value).join("");
  });
  console.log(`Values in PIN fields: ${pinValues}`);

  // 6. Click Verify
  console.log("Clicking 'Verify' button...");
  const verifyBtn = page.locator("form.pin-code-verification button[type='submit'], button:has-text('Verify')").first();
  await verifyBtn.click();

  console.log("Waiting 10s for verification to process and next step to load...");
  await page.waitForTimeout(10000);

  console.log("URL after verify:", page.url());
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
  console.log("Page content after verify:\n", bodyText);

  await page.screenshot({ path: "scratch/oracle_after_successful_verify.png" });
  await browser.close();
}

main().catch(console.error);
