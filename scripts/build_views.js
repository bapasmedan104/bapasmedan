const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

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
let code = '/** Auto-generated precompiled EJS templates for Cloudflare Workers & Serverless **/\n';
code += 'const ejs = require("ejs");\n\n';
code += 'const views = {\n';

for (const f of files) {
  const rel = path.relative(viewsDir, f).replace(/\\/g, '/').replace(/\.ejs$/, '');
  const src = fs.readFileSync(f, 'utf8');
  const fnStr = ejs.compile(src, { filename: f, client: true, compileDebug: false }).toString();
  code += `  ${JSON.stringify(rel)}: ${fnStr},\n`;
  code += `  ${JSON.stringify(rel + '.ejs')}: ${fnStr},\n`;
}

code += '};\n\nmodule.exports = views;\n';

const outPath = path.join(viewsDir, 'precompiledViews.js');
fs.writeFileSync(outPath, code, 'utf8');
console.log('✅ Generated precompiledViews.js successfully! Total size:', code.length);
