import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

/**
 * Connects to Gmail via TLS IMAP and polls for Taleo / Technatomy / TBE
 * email confirmation links sent to the candidate.
 */
export async function fetchTaleoVerificationLink(userEmail: string, timeoutMs: number = 60000): Promise<string | null> {
  const user = userEmail || process.env.GMAIL_USER || "babufakemail@gmail.com";
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

  if (!pass) {
    console.warn("⚠️ [Taleo Email Listener] GMAIL_APP_PASSWORD not set. Cannot fetch verification link.");
    return null;
  }

  const startTime = Date.now();
  console.log(`📡 [Taleo Email Listener] Polling Gmail (${user}) for Taleo confirmation link...`);

  while (Date.now() - startTime < timeoutMs) {
    const link = await new Promise<string | null>((resolve) => {
      const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
      socket.setEncoding("utf8");
      let buffer = "";
      let step = 0;

      const finish = (result: string | null) => {
        try {
          socket.write("a999 LOGOUT\r\n");
          socket.end();
        } catch (e) {}
        resolve(result);
      };

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
          socket.write(`a003 SEARCH X-GM-RAW "taleo OR Technatomy OR \\\"verify your email\\\" OR \\\"confirm your email\\\""\r\n`);
        } else if (step === 3 && buffer.includes("a003 OK")) {
          const match = buffer.match(/\* SEARCH (.*)\r\n/);
          const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
          if (ids.length === 0) {
            finish(null);
            return;
          }
          const latestId = ids[ids.length - 1];
          step = 4; buffer = "";
          socket.write(`a004 FETCH ${latestId} (BODY[HEADER.FIELDS (DATE)] BODY[TEXT])\r\n`);
        } else if (step === 4 && buffer.includes("a004 OK")) {
          const urlMatch = buffer.match(/href="([^"]*cwsProspectConfirmation[^"]*)"/i)
            || buffer.match(/href="([^"]*DispatcherServlet[^"]*)"/i)
            || buffer.match(/(https:\/\/[^"'\s<]+(?:DispatcherServlet|cwsProspectConfirmation)[^"'\s<]+)/i);

          if (urlMatch && urlMatch[1]) {
            const cleanUrl = urlMatch[1].replace(/&amp;/g, "&");
            finish(cleanUrl);
          } else {
            finish(null);
          }
        } else if (buffer.includes("NO") || buffer.includes("BAD")) {
          finish(null);
        }
      });

      socket.on("error", () => finish(null));
      setTimeout(() => finish(null), 8000);
    });

    if (link) {
      console.log(`🎉 [Taleo Email Listener] Found Taleo verification link: ${link}`);
      return link;
    }

    console.log(`⏳ [Taleo Email Listener] Waiting for Taleo email to arrive...`);
    await new Promise(r => setTimeout(r, 4000));
  }

  console.warn("⚠️ [Taleo Email Listener] Timed out waiting for Taleo confirmation email.");
  return null;
}

