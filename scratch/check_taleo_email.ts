import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

async function checkTaleoEmails() {
  const user = "babufakemail@gmail.com";
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

  console.log(`Connecting to IMAP for ${user}...`);

  return new Promise((resolve) => {
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
        socket.write(`a003 SEARCH X-GM-RAW "taleo OR Technatomy OR verification OR verify"\r\n`);
      } else if (step === 3 && buffer.includes("a003 OK")) {
        const match = buffer.match(/\* SEARCH (.*)\r\n/);
        const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
        console.log("Found matching email IDs:", ids);
        if (ids.length > 0) {
          const latestId = ids[ids.length - 1];
          step = 4; buffer = "";
          socket.write(`a004 FETCH ${latestId} (BODY[HEADER.FIELDS (SUBJECT FROM DATE)] BODY[TEXT])\r\n`);
        } else {
          socket.write("a999 LOGOUT\r\n");
          socket.end();
          resolve(null);
        }
      } else if (step === 4 && buffer.includes("a004 OK")) {
        console.log("\n--- LATEST EMAIL CONTENT ---");
        console.log(buffer);
        console.log("----------------------------");
        socket.write("a999 LOGOUT\r\n");
        socket.end();
        resolve(buffer);
      }
    });

    socket.on("error", (err) => {
      console.error("IMAP error:", err);
      resolve(null);
    });
  });
}

checkTaleoEmails().catch(console.error);

