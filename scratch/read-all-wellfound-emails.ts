import tls from "tls";

async function main() {
  const user = "tharunkomite7@gmail.com";
  const pass = "nviaxddgsnzcxmhc";

  console.log("Connecting to IMAP...");
  const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
  socket.setEncoding("utf8");

  let step = 0;
  let buffer = "";

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
      socket.write(`a003 SEARCH FROM "wellfound"\r\n`);
    } else if (step === 3 && buffer.includes("a003 OK")) {
      console.log("Search result:\n", buffer.trim());
      const match = buffer.match(/\* SEARCH (.*)\r\n/);
      const ids = match && match[1] ? match[1].trim().split(" ").filter(Boolean) : [];
      console.log(`Found ${ids.length} messages from Wellfound:`, ids);
      if (ids.length > 0) {
        step = 4;
        const lastId = ids[ids.length - 1];
        buffer = "";
        console.log(`Fetching latest email ID ${lastId}...`);
        socket.write(`a004 FETCH ${lastId} (BODY[HEADER.FIELDS (SUBJECT DATE)] BODY[TEXT])\r\n`);
      } else {
        socket.write("a999 LOGOUT\r\n");
      }
    } else if (step === 4 && buffer.includes("a004 OK")) {
      console.log("Latest email content:\n", buffer);
      socket.write("a999 LOGOUT\r\n");
      setTimeout(() => { socket.end(); process.exit(0); }, 500);
    }
  });

  socket.on("error", (err) => console.error(err));
}

main();

