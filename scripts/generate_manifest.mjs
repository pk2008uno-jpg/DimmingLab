import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.vite') continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const files = getFiles('.').sort();
let md = '# DimmingLab Review Package File Manifest\n\nGenerated: ' + new Date().toISOString() + '\n\n| Relative Path | Size (Bytes) | SHA-256 Checksum |\n|---|---|---|\n';

for (const f of files) {
  const rel = path.relative('.', f).replace(/\\/g, '/');
  if (rel === 'MANIFEST.md' || rel.endsWith('.zip')) continue;
  const content = fs.readFileSync(f);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const size = fs.statSync(f).size;
  md += '| `' + rel + '` | ' + size.toLocaleString() + ' | `' + hash + '` |\n';
}

fs.writeFileSync('MANIFEST.md', md);
console.log('MANIFEST.md successfully generated with', files.length, 'entries.');
