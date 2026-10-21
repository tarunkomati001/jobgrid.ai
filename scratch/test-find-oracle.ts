import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

const user = process.env.GMAIL_USER!;
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "")!;

export async function findOracleEmails() {
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
        // Search for Oracle emails
        socket.write(`a003 SEARCH TEXT "Oracle"\r\n`);
      } else if (step === 3 && buffer.includes("a003 OK")) {
        const match = buffer.match(/\* SEARCH (.*)\r\n/);
        const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
        console.log(`Found ${ids.length} emails containing "Oracle":`, ids.slice(-5));
        
        if (ids.length === 0) {
          socket.write("a999 LOGOUT\r\n");
          resolve([]);
          return;
        }

        const latestId = ids[ids.length - 1];
        step = 4;
        buffer = "";
        socket.write(`a004 FETCH ${latestId} (BODY[HEADER.FIELDS (SUBJECT FROM DATE)] BODY[TEXT])\r\n`);
      } else if (step === 4 && buffer.includes("a004 OK")) {
        console.log("=== LATEST ORACLE EMAIL CONTENT ===");
        console.log(buffer);
        socket.write("a999 LOGOUT\r\n");
        resolve(buffer);
      }
    });

    socket.on("error", (err) => {
      console.error(err);
      resolve(null);
    });

    setTimeout(() => {
      socket.end();
      resolve(null);
    }, 15000);
  });
}

findOracleEmails().then(() => process.exit(0));
