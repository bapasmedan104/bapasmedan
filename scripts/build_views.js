const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, '..', 'src', 'views');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(getFiles(file));
    else if (file.endsWith('.ejs')) results.push(file);
  });
  return results;
}

const files = getFiles(viewsDir);
let code = '/** In-memory EJS templates for Cloudflare Workers & Serverless without filesystem access **/\n';
code += 'module.exports = {\n';

for (const f of files) {
  const rel = path.relative(viewsDir, f).replace(/\\/g, '/');
  const src = fs.readFileSync(f, 'utf8');
  code += `  ${JSON.stringify(rel)}: ${JSON.stringify(src)},\n`;
  code += `  ${JSON.stringify('src/views/' + rel)}: ${JSON.stringify(src)},\n`;
  code += `  ${JSON.stringify(rel.replace(/\.ejs$/, ''))}: ${JSON.stringify(src)},\n`;
}

code += '};\n';

const outPath = path.join(viewsDir, 'rawViews.js');
fs.writeFileSync(outPath, code, 'utf8');
console.log('✅ Generated rawViews.js successfully! Total size:', code.length);
