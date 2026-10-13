import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

export interface OracleOtpOptions {
  timeoutMs?: number;
  knownOldCode?: string;
  minTimestamp?: number;
  minMessageId?: number;
}

export interface OracleInboxState {
  latestId: number;
  latestDate: number;
  latestCode: string;
}

/**
 * Inspects Gmail inbox for the current latest Oracle email.
 * Useful to call BEFORE clicking 'Next' so we know the baseline ID/timestamp
 * and can HOLD until a strictly newer email arrives.
 */
export async function getLatestOracleInboxState(): Promise<OracleInboxState | null> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (!user || !pass) return null;

  return new Promise((resolve) => {
    const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
    socket.setEncoding("utf8");

    let buffer = "";
    let step = 0;

    const finish = (result: OracleInboxState | null) => {
      try {
        socket.write("a999 LOGOUT\r\n");
        socket.end();
      } catch (e) {}
      resolve(result);
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
          finish({ latestId: 0, latestDate: 0, latestCode: "" });
          return;
        }

        const latestId = ids[ids.length - 1];
        step = 4;
        buffer = "";
        socket.write(`a004 FETCH ${latestId} (INTERNALDATE BODY[TEXT])\r\n`);
      } else if (step === 4 && buffer.includes("a004 OK")) {
        let latestDate = 0;
        const dateMatch = buffer.match(/INTERNALDATE "([^"]+)"/i);
        if (dateMatch && dateMatch[1]) {
          latestDate = new Date(dateMatch[1]).getTime() || 0;
        }

        let latestCode = "";
        const otpMatch = buffer.match(/(?:one-time\s*pass\s*code|pass\s*code|verification\s*code)[\s:]*([0-9]{6})/i);
        if (otpMatch && otpMatch[1]) {
          latestCode = otpMatch[1];
        }

        const match = buffer.match(/\* (\d+) FETCH/);
        const currentId = match && match[1] ? parseInt(match[1], 10) : 0;

        finish({ latestId: currentId, latestDate, latestCode });
      } else if (buffer.includes("NO") || buffer.includes("BAD")) {
        finish(null);
      }
    });

    socket.on("error", () => finish(null));
    setTimeout(() => finish(null), 8000);
  });
}

/**
 * Connects to Gmail via secure TLS IMAP, holds and polls until a FRESH
 * Oracle verification email arrives (arrived after request, or with newer ID/code),
 * and extracts the true 6-digit OTP code cleanly.
 */
export async function fetchLatestOracleOtp(
  optionsOrTimeout?: number | OracleOtpOptions,
  fallbackKnownOldCode: string = ""
): Promise<string | null> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (!user || !pass) {
    console.log("ℹ️ [Gmail OTP Listener] GMAIL_USER or GMAIL_APP_PASSWORD not set. Skipping automatic OTP retrieval.");
    return null;
  }

  let timeoutMs = 60000;
  let knownOldCode = fallbackKnownOldCode;
  let minTimestamp = 0;
  let minMessageId = 0;

  if (typeof optionsOrTimeout === "number") {
    timeoutMs = optionsOrTimeout;
  } else if (typeof optionsOrTimeout === "object" && optionsOrTimeout !== null) {
    if (optionsOrTimeout.timeoutMs) timeoutMs = optionsOrTimeout.timeoutMs;
    if (optionsOrTimeout.knownOldCode) knownOldCode = optionsOrTimeout.knownOldCode;
    if (optionsOrTimeout.minTimestamp) minTimestamp = optionsOrTimeout.minTimestamp;
    if (optionsOrTimeout.minMessageId) minMessageId = optionsOrTimeout.minMessageId;
  }

  console.log(`📡 [Gmail OTP Listener] Actively holding and polling inbox for fresh Oracle verification code (${user})...`);
  if (minMessageId > 0) {
    console.log(`   👉 Waiting for email newer than message ID: ${minMessageId}`);
  }
  if (minTimestamp > 0) {
    console.log(`   👉 Waiting for email sent after: ${new Date(minTimestamp).toLocaleTimeString()}`);
  }

  const startTime = Date.now();

  const pollOnce = async (): Promise<{ code: string; id: number } | null> => {
    return new Promise((resolve) => {
      const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
      socket.setEncoding("utf8");

      let buffer = "";
      let step = 0;

      const finish = (result: { code: string; id: number } | null) => {
        try {
          socket.write("a999 LOGOUT\r\n");
          socket.end();
        } catch (e) {}
        resolve(result);
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

          // If we have a baseline message ID, hold until a strictly higher ID appears
          if (minMessageId > 0 && latestId <= minMessageId) {
            finish(null);
            return;
          }

          step = 4;
          buffer = "";
          socket.write(`a004 FETCH ${latestId} (INTERNALDATE BODY[HEADER.FIELDS (SUBJECT FROM DATE)] BODY[TEXT])\r\n`);
        } else if (step === 4 && buffer.includes("a004 OK")) {
          // Check internal date if minTimestamp was specified
          if (minTimestamp > 0) {
            const dateMatch = buffer.match(/INTERNALDATE "([^"]+)"/i);
            if (dateMatch && dateMatch[1]) {
              const emailTime = new Date(dateMatch[1]).getTime();
              // Allow up to 10 seconds of clock drift, but reject emails from minutes/hours ago
              if (!isNaN(emailTime) && emailTime < minTimestamp - 10000) {
                // Email is too old! Hold and wait for new email
                finish(null);
                return;
              }
            }
          }

          // Extract OTP cleanly
          // Oracle emails: "You must confirm your identity using this one-time pass code: 779487"
          const otpRegex = /(?:one-time\s*pass\s*code|pass\s*code|verification\s*code|identity\s*code)[\s:]*([0-9]{6})/i;
          const match = buffer.match(otpRegex);

          if (match && match[1]) {
            const foundCode = match[1];
            if (foundCode !== knownOldCode) {
              const idMatch = buffer.match(/\* (\d+) FETCH/);
              const foundId = idMatch && idMatch[1] ? parseInt(idMatch[1], 10) : 0;
              finish({ code: foundCode, id: foundId });
              return;
            }
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

  let attempts = 0;
  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    const res = await pollOnce();
    if (res && res.code) {
      console.log(`\n🎉 [Gmail OTP Listener] Successfully detected fresh Oracle verification OTP code: ${res.code}`);
      return res.code;
    }
    if (attempts % 3 === 0) {
      console.log(`⏳ [Gmail OTP Listener] Still waiting for Oracle verification email to arrive in Gmail (${Math.round((Date.now() - startTime) / 1000)}s)...`);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }

  console.warn("⚠️ [Gmail OTP Listener] Timed out waiting for fresh Oracle verification email.");
  return null;
}
