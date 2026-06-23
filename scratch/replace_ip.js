import fs from 'fs';
import path from 'path';

const dirs = [
  'd:\\INTERNSHIP_PROJECT_TAG97\\User\\Book-My-Venue-User\\src',
  'd:\\INTERNSHIP_PROJECT_TAG97\\Vendor\\Book-My-Venue-Vendor\\src'
];

const oldIp = '192.168.1.6';
const newIp = '192.168.1.12';

let count = 0;

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (stat.isFile() && /\.(js|ts|tsx|jsx|html|css|json)$/.test(file)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(oldIp)) {
        const newContent = content.replaceAll(oldIp, newIp);
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Updated IP in: ${fullPath}`);
        count++;
      }
    }
  }
}

for (const d of dirs) {
  console.log(`Processing directory: ${d}`);
  processDirectory(d);
}

console.log(`Finished updating ${count} files.`);
