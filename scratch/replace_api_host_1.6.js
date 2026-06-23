import fs from "fs";
import path from "path";

const TARGET_DIRS = [
  "d:\\INTERNSHIP_PROJECT_TAG97\\User",
  "d:\\INTERNSHIP_PROJECT_TAG97\\Vendor"
];

const IGNORE_DIRS = ["node_modules", "dist", ".git", ".github", "build", "dist"];
const EXTENSIONS = [".ts", ".tsx", ".js", ".json", ".css", ".html"];

function processDirectory(dir) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
    return;
  }

  for (const file of files) {
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (err) {
      continue;
    }

    if (stat.isDirectory()) {
      if (IGNORE_DIRS.includes(file)) continue;
      processDirectory(fullPath);
    } else if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (EXTENSIONS.includes(ext)) {
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          let changed = false;
          let updatedContent = content;
          
          if (content.includes("192.168.1.4:3000")) {
            updatedContent = updatedContent.replace(/192.168.1.4:3000/g, "192.168.1.6:3000");
            changed = true;
          }
          if (content.includes("localhost:3000")) {
            updatedContent = updatedContent.replace(/localhost:3000/g, "192.168.1.6:3000");
            changed = true;
          }
          
          if (changed) {
            fs.writeFileSync(fullPath, updatedContent, "utf8");
            console.log(`[UPDATED] ${fullPath}`);
          }
        } catch (err) {
          console.error(`Error processing file ${fullPath}:`, err.message);
        }
      }
    }
  }
}

console.log("Starting replacement of hosts with 192.168.1.6:3000...");
for (const target of TARGET_DIRS) {
  processDirectory(target);
}
console.log("Replacement completed.");
