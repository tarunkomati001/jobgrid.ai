import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
console.log("Checking IMAP for user:", user);

const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
socket.setEncoding("utf8");

let buffer = "";
let step = 0;

socket.on("data", (chunk: string) => {
  buffer += chunk;
  console.log("[INCOMING CHUNK LENGTH]:", chunk.length);

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
    const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
    console.log("Found Oracle message IDs count:", ids.length, ids.slice(-5));
    if (ids.length > 0) {
      step = 4;
      const latestId = ids[ids.length - 1];
      buffer = "";
      console.log("Fetching message id:", latestId);
      socket.write(`a004 FETCH ${latestId} (INTERNALDATE BODY[HEADER.FIELDS (SUBJECT FROM DATE)] BODY[TEXT])\r\n`);
    } else {
      socket.write("a999 LOGOUT\r\n");
    }
  } else if (step === 4 && buffer.includes("a004 OK")) {
    console.log("--- FETCHED MESSAGE START ---");
    console.log(buffer.slice(0, 3000));
    console.log("--- FETCHED MESSAGE END ---");
    socket.write("a999 LOGOUT\r\n");
    setTimeout(() => {
      socket.end();
      process.exit(0);
    }, 500);
  }
});

socket.on("error", (err) => {
  console.error("Socket error:", err);
  process.exit(1);
});

setTimeout(() => {
  console.log("Timed out after 15s");
  socket.end();
  process.exit(0);
}, 15000);
