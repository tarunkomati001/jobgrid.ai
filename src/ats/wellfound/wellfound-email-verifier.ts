import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

/**
 * Fetches the latest Wellfound verification code from Gmail inbox using raw IMAP.
 * Searches for recent emails from Wellfound (noreply@wellfound.com) containing verification codes.
 */
export async function fetchWellfoundVerificationCode(
  maxWaitMs: number = 90000,
  pollIntervalMs: number = 5000,
  customUser?: string,
  customPass?: string
): Promise<string | null> {
  const gmailUser = customUser || process.env.GMAIL_USER || "babufakemail@gmail.com";
  const gmailPass = (customPass || process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

  if (!gmailPass) {
    console.warn("⚠️ [WellfoundEmailVerifier]: GMAIL_APP_PASSWORD not set. Cannot fetch verification code.");
    return null;
  }

  console.log(`📧 [WellfoundEmailVerifier]: Polling Gmail (${gmailUser}) for Wellfound verification code...`);
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const code = await doImapFetch(gmailUser, gmailPass);
    if (code) {
      console.log(`✅ [WellfoundEmailVerifier]: Found verification code: ${code}`);
      return code;
    }

    console.log(`⏳ [WellfoundEmailVerifier]: No code yet, retrying in ${pollIntervalMs / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  console.warn("⚠️ [WellfoundEmailVerifier]: Timed out waiting for verification code.");
  return null;
}

/**
 * Fetches the latest Wellfound verification link from Gmail inbox using raw IMAP.
 */
export async function fetchWellfoundVerificationLink(
  maxWaitMs: number = 90000,
  pollIntervalMs: number = 5000,
  customUser?: string,
  customPass?: string
): Promise<string | null> {
  const gmailUser = customUser || process.env.GMAIL_USER || "babufakemail@gmail.com";
  const gmailPass = (customPass || process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

  if (!gmailPass) {
    console.warn("⚠️ [WellfoundEmailVerifier]: GMAIL_APP_PASSWORD not set. Cannot fetch verification link.");
    return null;
  }

  console.log(`📧 [WellfoundEmailVerifier]: Polling Gmail (${gmailUser}) for Wellfound verification link...`);
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const link = await doImapFetchLink(gmailUser, gmailPass);
    if (link) {
      console.log(`✅ [WellfoundEmailVerifier]: Found verification link: ${link}`);
      return link;
    }

    console.log(`⏳ [WellfoundEmailVerifier]: No link yet, retrying in ${pollIntervalMs / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  console.warn("⚠️ [WellfoundEmailVerifier]: Timed out waiting for verification link.");
  return null;
}

/**
 * Single IMAP fetch attempt to find a Wellfound verification code
 */
function doImapFetch(user: string, pass: string): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
    socket.setEncoding("utf8");

    let buffer = "";
    let step = 0;
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; socket.end(); resolve(null); }
    }, 20000);

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
        // Search for recent emails from Wellfound (seen or unseen)
        socket.write(`a003 SEARCH FROM "wellfound"\r\n`);
      } else if (step === 3 && buffer.includes("a003 OK")) {
        const match = buffer.match(/\* SEARCH (.*)\r\n/);
        const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
        if (ids.length > 0) {
          step = 4;
          const latestId = ids[ids.length - 1];
          buffer = "";
          socket.write(`a004 FETCH ${latestId} (BODY[HEADER.FIELDS (SUBJECT)] BODY[TEXT])\r\n`);
        } else {
          // Try broader search including "angellist"
          step = 5; buffer = "";
          socket.write(`a005 SEARCH TEXT "wellfound" TEXT "code"\r\n`);
        }
      } else if (step === 5 && buffer.includes("a005 OK")) {
        const match = buffer.match(/\* SEARCH (.*)\r\n/);
        const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
        if (ids.length > 0) {
          step = 4;
          const latestId = ids[ids.length - 1];
          buffer = "";
          socket.write(`a006 FETCH ${latestId} (BODY[HEADER.FIELDS (SUBJECT)] BODY[TEXT])\r\n`);
        } else {
          resolved = true; clearTimeout(timeout);
          socket.write("a999 LOGOUT\r\n");
          resolve(null);
        }
      } else if (step === 4 && (buffer.includes("a004 OK") || buffer.includes("a006 OK"))) {
        // Extract verification code (first priority from subject line, then body)
        const codeMatch = buffer.match(/Subject:[^\r\n]*\b(\d{6})\b/i)
          || buffer.match(/(?:verification|confirm|code)[^\d]*(\d{4,8})/i)
          || buffer.match(/(?:enter|use|code|pin|otp)[\s:]*(\d{4,8})/i)
          || buffer.match(/\b(\d{6})\b/);

        if (codeMatch && codeMatch[1]) {
          resolved = true; clearTimeout(timeout);
          socket.write("a999 LOGOUT\r\n");
          resolve(codeMatch[1]);
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

/**
 * Single IMAP fetch attempt to find a Wellfound verification link
 */
function doImapFetchLink(user: string, pass: string): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
    socket.setEncoding("utf8");

    let buffer = "";
    let step = 0;
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; socket.end(); resolve(null); }
    }, 20000);

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
        // Search for recent unseen Wellfound emails
        socket.write(`a003 SEARCH UNSEEN FROM "wellfound"\r\n`);
      } else if (step === 3 && buffer.includes("a003 OK")) {
        const match = buffer.match(/\* SEARCH (.*)\r\n/);
        const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
        if (ids.length > 0) {
          step = 4;
          const latestId = ids[ids.length - 1];
          buffer = "";
          socket.write(`a004 FETCH ${latestId} (BODY[])\r\n`);
        } else {
          // Also try "angel" as sender 
          step = 5; buffer = "";
          socket.write(`a005 SEARCH UNSEEN FROM "angel"\r\n`);
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
        // Extract verification link from email body
        // Look for links like https://wellfound.com/verify/... or https://wellfound.com/confirm/...
        const linkMatch = buffer.match(/https?:\/\/(?:www\.)?wellfound\.com\/(?:verify|confirm|email[_-]?verif)[^\s"'<>\])]+/i)
          || buffer.match(/https?:\/\/(?:www\.)?wellfound\.com\/users\/confirmation[^\s"'<>\])]+/i)
          || buffer.match(/https?:\/\/(?:www\.)?angel\.co\/(?:verify|confirm)[^\s"'<>\])]+/i)
          || buffer.match(/href=3D"(https?:\/\/(?:www\.)?wellfound\.com\/[^\s"]*confirm[^\s"]*?)"/i)
          || buffer.match(/href="(https?:\/\/(?:www\.)?wellfound\.com\/[^\s"]*confirm[^\s"]*?)"/i)
          || buffer.match(/href=3D"(https?:\/\/(?:www\.)?wellfound\.com\/[^\s"]*verif[^\s"]*?)"/i)
          || buffer.match(/href="(https?:\/\/(?:www\.)?wellfound\.com\/[^\s"]*verif[^\s"]*?)"/i);

        if (linkMatch) {
          let link = linkMatch[1] || linkMatch[0];
          // Decode quoted-printable =3D encoding
          link = link.replace(/=3D/gi, "=").replace(/=\r?\n/g, "");
          resolved = true; clearTimeout(timeout);
          socket.write("a999 LOGOUT\r\n");
          resolve(link);
        } else {
          // Also look for any link containing "confirm" or "verify" from wellfound domain
          const anyLink = buffer.match(/https?:\/\/[^\s"'<>\])]*wellfound[^\s"'<>\])]*(?:confirm|verif|token)[^\s"'<>\])]+/i);
          if (anyLink) {
            let link = anyLink[0].replace(/=3D/gi, "=").replace(/=\r?\n/g, "");
            resolved = true; clearTimeout(timeout);
            socket.write("a999 LOGOUT\r\n");
            resolve(link);
          } else {
            resolved = true; clearTimeout(timeout);
            socket.write("a999 LOGOUT\r\n");
            resolve(null);
          }
        }
      }
    });

    socket.on("error", () => {
      if (!resolved) { resolved = true; clearTimeout(timeout); resolve(null); }
    });
  });
}

