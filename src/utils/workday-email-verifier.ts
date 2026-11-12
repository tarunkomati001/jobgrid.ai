import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Polls Gmail IMAP for the latest Workday activation / verification URL.
 * Automatically decodes quoted-printable soft breaks so URLs are never truncated.
 */
export async function pollWorkdayVerificationUrl(timeoutMs = 60000): Promise<string | null> {
  const user = process.env.GMAIL_USER || "babufakemail@gmail.com";
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

  if (!user || !pass) {
    console.warn("⚠️ [WorkdayEmailVerifier]: GMAIL_USER or GMAIL_APP_PASSWORD not set in environment.");
    return null;
  }

  const startTime = Date.now();
  console.log(`📧 [WorkdayEmailVerifier]: Polling IMAP for Workday verification email (${user})...`);

  while (Date.now() - startTime < timeoutMs) {
    const link = await new Promise<string | null>((resolve) => {
      const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
      socket.setEncoding("utf8");
      let buffer = "";
      let step = 0;

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
          // Search unseen or recent messages
          socket.write(`a003 SEARCH UNSEEN\r\n`);
        } else if (step === 3 && buffer.includes("a003 OK")) {
          const match = buffer.match(/\* SEARCH (.*)\r\n/);
          const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
          if (ids.length > 0) {
            step = 4;
            const latestId = ids[ids.length - 1];
            buffer = "";
            socket.write(`a004 FETCH ${latestId} (BODY[TEXT] BODY[HEADER.FIELDS (SUBJECT FROM DATE)])\r\n`);
          } else {
            socket.write("a999 LOGOUT\r\n");
            setTimeout(() => { socket.end(); resolve(null); }, 150);
          }
        } else if (step === 4 && buffer.includes("a004 OK")) {
          socket.write("a999 LOGOUT\r\n");
          setTimeout(() => {
            socket.end();
            const decoded = decodeQuotedPrintable(buffer);
            // Look for Workday activate / verify / token URL
            const urlMatches = decoded.match(/https:\/\/[^\s"'<>]+(?:activate|verify|token|validate)[^\s"'<>]+/gi);
            if (urlMatches && urlMatches.length > 0) {
              const cleanUrl = urlMatches[0].replace(/&amp;/g, "&");
              resolve(cleanUrl);
            } else {
              resolve(null);
            }
          }, 250);
        }
      });

      socket.on("error", () => resolve(null));
      setTimeout(() => { socket.end(); resolve(null); }, 12000);
    });

    if (link) {
      console.log(`🎉 [WorkdayEmailVerifier]: Extracted activation URL: ${link}`);
      return link;
    }

    console.log("  [WorkdayEmailVerifier]: Waiting 5s for email delivery...");
    await new Promise(r => setTimeout(r, 5000));
  }

  console.warn("⚠️ [WorkdayEmailVerifier]: IMAP polling timed out without receiving verification link.");
  return null;
}
