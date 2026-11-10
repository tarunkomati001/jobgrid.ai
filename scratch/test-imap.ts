import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

async function testGmailImap() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  console.log("Testing Gmail IMAP for user:", user);
  if (!user || !pass) {
    console.error("No GMAIL_USER or GMAIL_APP_PASSWORD found!");
    return;
  }

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
      // Use X-GM-RAW for broad Gmail search covering all Oracle hostings & OTP subjects
      socket.write(`a003 SEARCH X-GM-RAW "oracle OR oraclecloud OR \\\"verification code\\\" OR \\\"pass code\\\""\r\n`);
    } else if (step === 3 && buffer.includes("a003 OK")) {
      console.log("SEARCH RESPONSE:", buffer.trim());
      const match = buffer.match(/\* SEARCH (.*)\r\n/);
      const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean).map(Number) : [];
      console.log(`Found ${ids.length} matching email IDs`);
      if (ids.length > 0) {
        const latestId = ids[ids.length - 1];
        step = 4;
        buffer = "";
        socket.write(`a004 FETCH ${latestId} (INTERNALDATE BODY[HEADER.FIELDS (SUBJECT FROM DATE)] BODY[TEXT])\r\n`);
      } else {
        socket.write("a999 LOGOUT\r\n");
        socket.end();
      }
    } else if (step === 4 && buffer.includes("a004 OK")) {
      console.log("LATEST EMAIL FETCH OUTPUT:\n", buffer.slice(0, 500));
      const otpRegex = /(?:one-time\s*pass\s*code|pass\s*code|verification\s*code|identity\s*code)[\s:]*([0-9]{6})/i;
      const m = buffer.match(otpRegex);
      console.log("Extracted OTP:", m ? m[1] : "None found");
      socket.write("a999 LOGOUT\r\n");
      socket.end();
    }
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err);
  });
}

testGmailImap();

