import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

async function findOracle() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
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
      socket.write(`a003 SEARCH FROM "oracle" OR SUBJECT "oracle" OR TEXT "oraclecloud"\r\n`);
    } else if (step === 3 && buffer.includes("a003 OK")) {
      console.log("ORACLE SEARCH:", buffer.trim());
      const match = buffer.match(/\* SEARCH (.*)\r\n/);
      const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean).map(Number) : [];
      console.log(`Found ${ids.length} matching Oracle email IDs:`, ids.slice(-5));
      if (ids.length > 0) {
        step = 4;
        buffer = "";
        socket.write(`a004 FETCH ${ids[ids.length - 1]} (BODY[HEADER.FIELDS (SUBJECT FROM DATE)] BODY[TEXT])\r\n`);
      } else {
        socket.write("a999 LOGOUT\r\n");
        socket.end();
      }
    } else if (step === 4 && buffer.includes("a004 OK")) {
      console.log("FETCHED ORACLE EMAIL:\n", buffer.slice(0, 1000));
      socket.write("a999 LOGOUT\r\n");
      socket.end();
    }
  });
}

findOracle();

