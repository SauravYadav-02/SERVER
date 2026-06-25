import fs from "fs";
import path from "path";

const searchDir = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git") {
        searchDir(filePath);
      }
    } else if (file.endsWith(".js") || file.endsWith(".ts")) {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        if (line.includes("activatePlan")) {
          console.log(`${filePath}:${i+1}: ${line.trim()}`);
        }
      });
    }
  }
};

searchDir(".");
