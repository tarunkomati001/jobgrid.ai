import tls from "tls";
import dotenv from "dotenv";
import { createPersistentBrowserContext } from "../src/browser/browser-manager";
import { saveWellfoundCredentials } from "../src/ats/wellfound/wellfound-account-store";
import { isWellfoundLoggedIn } from "../src/ats/wellfound/wellfound-auth";

dotenv.config();

const TARGET_EMAIL = "babufakemail@gmail.com";
const NEW_PASSWORD = "HrutinDev@2024!";

async function main() {
  console.log("===============================================================================");
  console.log("🔑 WELLFOUND PASSWORD SETTING / RESET FLOW");
  console.log(`📧 Target Email: ${TARGET_EMAIL}`);
  console.log(`🔒 New Password: ${NEW_PASSWORD}`);
  console.log("===============================================================================\n");

  const context = await createPersistentBrowserContext(false);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  // 1. Navigate to reset password page
  console.log("👉 Step 1: Navigating to https://wellfound.com/password/new...");
  await page.goto("https://wellfound.com/password/new", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);

  // 2. Fill email
  const emailInput = page.locator("#user_email, input[name='username']").first();
  console.log(`✍️ Step 2: Entering email: ${TARGET_EMAIL}...`);
  await emailInput.fill(TARGET_EMAIL);
  await page.waitForTimeout(500);

  // 3. Submit
  const submitBtn = page.locator("input[type='submit'], button[type='submit']").first();
  console.log("🚀 Step 3: Submitting reset request...");
  await submitBtn.click();
  await page.waitForTimeout(4000);

  await page.screenshot({ path: "scratch/password_reset_submitted.png" });
  console.log("Page after submit:", page.url());

  // 4. Poll Gmail inbox via IMAP for the reset email
  console.log("📬 Step 4: Polling Gmail inbox for password reset email...");
  const resetLink = await pollForResetLink(60000, 4000);

  if (!resetLink) {
    console.error("❌ Failed to receive password reset link from Wellfound within timeout.");
    await context.close();
    return;
  }

  console.log(`🔗 Step 5: Found reset link: ${resetLink}`);
  console.log("👉 Navigating to password reset link...");
  await page.goto(resetLink, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "scratch/password_reset_form.png" });

  // 6. Fill new password
  console.log("✍️ Step 6: Setting new password...");
  const newPwInputs = page.locator("input[type='password']");
  const count = await newPwInputs.count();
  console.log(`Found ${count} password input(s).`);

  for (let i = 0; i < count; i++) {
    await newPwInputs.nth(i).fill(NEW_PASSWORD);
    await page.waitForTimeout(300);
  }

  // 7. Submit new password
  const savePwBtn = page.locator("input[type='submit'], button:has-text('Change'), button:has-text('Reset'), button:has-text('Save'), button[type='submit']").first();
  console.log("🚀 Step 7: Saving new password...");
  await savePwBtn.click();
  await page.waitForTimeout(5000);

  await page.screenshot({ path: "scratch/password_reset_completed.png" });
  console.log("Page after password change:", page.url());

  // Save the new credential
  await saveWellfoundCredentials({
    email: TARGET_EMAIL,
    password: NEW_PASSWORD,
    name: "Hrutin Nammi",
    updatedAt: new Date().toISOString()
  });
  console.log("💾 Saved new credentials to store and database!");

  const loggedIn = await isWellfoundLoggedIn(page);
  console.log(`🏁 Authentication Status: ${loggedIn ? "✅ LOGGED IN" : "ℹ️ Check screenshot"}`);

  await page.waitForTimeout(5000);
  await context.close();
}

function pollForResetLink(maxWaitMs: number, pollIntervalMs: number): Promise<string | null> {
  const gmailUser = process.env.GMAIL_USER || "babufakemail@gmail.com";
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

  return new Promise(async (resolve) => {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      console.log(`Polling Gmail (${Math.round((Date.now() - startTime) / 1000)}s)...`);
      const link = await fetchSingleResetAttempt(gmailUser, gmailPass);
      if (link) {
        return resolve(link);
      }
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
    resolve(null);
  });
}

function fetchSingleResetAttempt(user: string, pass: string): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
    socket.setEncoding("utf8");

    let buffer = "";
    let step = 0;
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; socket.end(); resolve(null); }
    }, 15000);

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (step === 0 && buffer.includes("* OK")) {
        step = 1; buffer = "";
        socket.write(`a001 LOGIN ${user} ${pass}\r\n`);
      } else if (step === 1 && buffer.includes("a001 OK")) {
        step = 2; buffer = "";
        socket.write(`a002 SELECT INBOX\r\n`);
      } else if (step === 2 && buffer.includes("a002 OK")) {
        step = 3; buffer = "";
        // Search unseen emails from wellfound or text password
        socket.write(`a003 SEARCH UNSEEN TEXT "password"\r\n`);
      } else if (step === 3 && buffer.includes("a003 OK")) {
        const match = buffer.match(/\* SEARCH (.*)\r\n/);
        const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
        if (ids.length > 0) {
          step = 4;
          const latestId = ids[ids.length - 1];
          buffer = "";
          socket.write(`a004 FETCH ${latestId} (BODY[])\r\n`);
        } else {
          // Also check all recent emails text "password" or "wellfound"
          step = 5; buffer = "";
          socket.write(`a005 SEARCH TEXT "wellfound" TEXT "password"\r\n`);
        }
      } else if (step === 5 && buffer.includes("a005 OK")) {
        const match = buffer.match(/\* SEARCH (.*)\r\n/);
        const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
        if (ids.length > 0) {
          step = 4;
          const latestId = ids[ids.length - 1];
          buffer = "";
          socket.write(`a006 FETCH ${latestId} (BODY[])\r\n`);
        } else {
          resolved = true; clearTimeout(timeout);
          socket.write("a999 LOGOUT\r\n");
          resolve(null);
        }
      } else if (step === 4 && (buffer.includes("a004 OK") || buffer.includes("a006 OK"))) {
        // Find reset link in email body
        const linkMatch = buffer.match(/https?:\/\/[^\s"'>]*wellfound\.com\/password\/edit[^\s"'>]*/i) ||
          buffer.match(/https?:\/\/[^\s"'>]*wellfound\.com\/users\/password\/edit[^\s"'>]*/i) ||
          buffer.match(/https?:\/\/[^\s"'>]*angel\.co\/password\/edit[^\s"'>]*/i) ||
          buffer.match(/https?:\/\/[^\s"'>]*links\.wellfound\.com[^\s"'>]*/i);

        if (linkMatch) {
          let link = linkMatch[0].replace(/=3D/gi, "=").replace(/=\r?\n/g, "").replace(/&amp;/g, "&");
          resolved = true; clearTimeout(timeout);
          socket.write("a999 LOGOUT\r\n");
          resolve(link);
        } else {
          resolved = true; clearTimeout(timeout);
          socket.write("a999 LOGOUT\r\n");
          resolve(null);
        }
      }
    });

    socket.on("error", () => {
      if (!resolved) { resolved = true; clearTimeout(timeout); resolve(null); }
    });
  });
}

main().catch(console.error);

