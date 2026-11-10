import https from "https";

const url = "https://snapsheet.applytojob.com/js/apply/submit-resume.js?9.10.3";

https.get(url, (res) => {
  let data = "";
  res.on("data", chunk => { data += chunk; });
  res.on("end", () => {
    let pos = 0;
    while ((pos = data.indexOf("resumator-resume-value", pos)) !== -1) {
      console.log(`\n--- Match at ${pos} ---`);
      console.log(data.slice(pos - 50, pos + 300));
      pos += 22;
    }
  });
}).on("error", console.error);
