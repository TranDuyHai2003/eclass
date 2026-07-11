const fs = require('fs');
const file = 'd:/eclass/app/api/admin/export-offline/route.ts';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace(/\\`\\$\\{/g, '`${');
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\${/g, '${');
fs.writeFileSync(file, content);
