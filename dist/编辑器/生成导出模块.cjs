const fs=require('node:fs'),{validate,exportHtml}=require('./map-core.cjs');
const finite3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const safe=v=>JSON.stringify(v).replace(/</g,'\\u003c');
fs.writeFileSync(__dirname+'/map-export.js',`(()=>{const finite3=${finite3.toString()},safe=${safe.toString()};window.alongValidateMap=${validate.toString()};window.alongExportHtml=${exportHtml.toString()};})();`);
