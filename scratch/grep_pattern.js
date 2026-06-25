import fs from "fs";

const content = fs.readFileSync("services/subscriptionService.js", "utf8");
const lines = content.split("\n");
lines.forEach((line, i) => {
  if (line.includes("createPaymentHistory")) {
    console.log(`${i+1}: ${line}`);
  }
});
