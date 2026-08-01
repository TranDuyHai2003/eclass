const fs = require("fs");
const path = require("path");

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy thư mục public vào standalone
const publicSrc = path.join(__dirname, "public");
const publicDest = path.join(__dirname, ".next", "standalone", "public");
copyRecursiveSync(publicSrc, publicDest);

// Copy thư mục .next/static vào standalone
const staticSrc = path.join(__dirname, ".next", "static");
const staticDest = path.join(
  __dirname,
  ".next",
  "standalone",
  ".next",
  "static",
);
copyRecursiveSync(staticSrc, staticDest);

console.log("✅ Đã copy xong thư mục static và public vào standalone!");
