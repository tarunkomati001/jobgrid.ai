import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

const user = process.env.GMAIL_USER!;
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "")!;

export async function fetchLatestOracleOtp(maxWaitMs: number = 30000): Promise<string | null> {
  const startTime = Date.now();

  const checkOnce = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
      socket.setEncoding("utf8");

      let buffer = "";
      let step = 0;

      const finish = (val: string | null) => {
        try {
          socket.write("a999 LOGOUT\r\n");
          socket.end();
        } catch (e) {}
        resolve(val);
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
          // Search for emails with ORACLE or VERIFICATION
          socket.write(`a003 SEARCH ALL\r\n`);
        } else if (step === 3 && buffer.includes("a003 OK")) {
          const match = buffer.match(/\* SEARCH (.*)\r\n/);
          const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
          if (ids.length === 0) {
            finish(null);
            return;
          }

          // Fetch the last 3 emails
          const lastIds = ids.slice(-3);
          step = 4;
          buffer = "";
          socket.write(`a004 FETCH ${lastIds.join(",")} (BODY[HEADER.FIELDS (SUBJECT FROM DATE)] BODY[TEXT])\r\n`);
        } else if (step === 4 && buffer.includes("a004 OK")) {
          console.log("=== RAW RECENT EMAILS DUMP ===");
          console.log(buffer.slice(0, 2000));

          // Look for 6 digit code in Oracle messages
          const otpMatches = Array.from(buffer.matchAll(/\b(\d{6})\b/g)).map(m => m[1]);
          console.log("Potential OTPs found in recent messages:", otpMatches);
          
          // Let's filter out non-OTPs (like year 2026 or timestamps if any)
          // Usually Oracle says: "Your verification code is: 123456" or "enter the code 123456"
          const targeted = buffer.match(/(?:code|verification|pin)[^\d]{1,30}(\d{6})/i) ||
                           buffer.match(/(\d{6})[^\d]{1,30}(?:is your verification code|is your code)/i);
          
          if (targeted && targeted[1]) {
            console.log("🎯 Targeted Oracle OTP extracted:", targeted[1]);
            finish(targeted[1]);
            return;
          }

          if (otpMatches.length > 0) {
            // Pick the latest match
            finish(otpMatches[otpMatches.length - 1]);
            return;
          }

          finish(null);
        } else if (buffer.includes("NO") || buffer.includes("BAD")) {
          console.error("IMAP Error response:", buffer);
          finish(null);
        }
      });

      socket.on("error", (err) => {
        console.error("IMAP connection error:", err);
        finish(null);
      });

      setTimeout(() => finish(null), 10000);
    });
  };

  while (Date.now() - startTime < maxWaitMs) {
    const otp = await checkOnce();
    if (otp) return otp;
    await new Promise(r => setTimeout(r, 3000));
  }

  return null;
}

if (require.main === module) {
  fetchLatestOracleOtp(15000).then(otp => {
    console.log("Final Extracted OTP:", otp);
    process.exit(0);
  });
}
