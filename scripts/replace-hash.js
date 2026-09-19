const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, '..', 'src'));
let changedCount = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Need to replace `href="#/` with `href="/`
  // Also `navigate("#/` to `navigate("/`
  // Actually, just replacing `="#/` with `="/` and `('#/` with `('/` and `("#/` with `("/` is safer.
  let newContent = content.replace(/href="#\//g, 'href="/');
  newContent = newContent.replace(/navigate\("#\//g, 'navigate("/');
  newContent = newContent.replace(/navigate\('#\//g, 'navigate(\'/');
  newContent = newContent.replace(/href: "#\//g, 'href: "/');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
    changedCount++;
  }
});

console.log(`Replaced links in ${changedCount} files.`);
