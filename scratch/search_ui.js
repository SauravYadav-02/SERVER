import fs from 'fs';
import path from 'path';

const searchDir = 'd:\\INTERNSHIP_PROJECT_TAG97';

function searchFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.cache') {
      continue;
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchFiles(fullPath);
    } else if (stat.isFile() && /\.(js|ts|tsx|jsx|html|css|json)$/.test(file)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes('reports filed against you') || content.toLowerCase().includes('policy & compliance') || content.toLowerCase().includes('reporter profile')) {
        console.log(`Found match in: ${fullPath}`);
      }
    }
  }
}

searchFiles(searchDir);
