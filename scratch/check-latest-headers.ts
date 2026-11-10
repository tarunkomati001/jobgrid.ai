import tls from "tls";
import dotenv from "dotenv";
dotenv.config();

const user = process.env.GMAIL_USER || "babufakemail@gmail.com";
const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

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
    // Fetch last 5 message headers
    socket.write(`a003 SEARCH ALL\r\n`);
  } else if (step === 3 && buffer.includes("a003 OK")) {
    const match = buffer.match(/\* SEARCH (.*)\r\n/);
    const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
    console.log("Total messages:", ids.length);
    const last5 = ids.slice(-5);
    console.log("Last 5 IDs:", last5);
    step = 4; buffer = "";
    socket.write(`a004 FETCH ${last5.join(",")} (BODY[HEADER.FIELDS (SUBJECT FROM DATE)])\r\n`);
  } else if (step === 4 && buffer.includes("a004 OK")) {
    console.log("Headers:\n", buffer);
    socket.write("a999 LOGOUT\r\n");
    setTimeout(() => { socket.end(); process.exit(0); }, 500);
  }
});

setTimeout(() => { socket.end(); process.exit(0); }, 10000);

