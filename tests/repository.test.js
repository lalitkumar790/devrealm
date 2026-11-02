import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTree, moduleForPath, childrenAt, extractImportSpecifiers, resolveImportPath } from "../src/repository.js";

test("analyzeTree counts files, source files and directory contents", () => {
  const result = analyzeTree([
    {path:"src/main.js",type:"blob",size:120},
    {path:"src/lib/math.ts",type:"blob",size:80},
    {path:"README.md",type:"blob",size:30},
    {path:"assets/logo.svg",type:"blob",size:20},
    {path:".git/config",type:"blob",size:5}
  ]);
  assert.equal(result.totalFiles,4);
  assert.equal(result.sourceCount,2);
  assert.equal(result.roots.find(item=>item.path==="src").files,2);
  assert.equal(result.roots.find(item=>item.path==="assets").files,1);
});

test("moduleForPath groups files by their top-level folder", () => {
  assert.equal(moduleForPath("src/components/App.jsx"),"src");
  assert.equal(moduleForPath("README.md"),"root");
});

test("childrenAt returns only immediate folders and files",()=>{const tree=analyzeTree([{path:"src/main.js",type:"blob",size:10},{path:"src/lib/math.ts",type:"blob",size:20},{path:"src/lib/format.ts",type:"blob",size:30}]);const root=childrenAt(tree,"src");assert.deepEqual(root.directories.map(x=>x.path),["src/lib"]);assert.deepEqual(root.files.map(x=>x.path),["src/main.js"]);const nested=childrenAt(tree,"src/lib");assert.equal(nested.files.length,2);});
test("extractImportSpecifiers finds relative ES module and require references",()=>{const refs=extractImportSpecifiers(`import thing from "./thing.js";\nexport { value } from "../shared/value.js";\nconst x=require("./local");`);assert.deepEqual(refs,["./thing.js","../shared/value.js","./local"]);});

test("resolveImportPath resolves relative extensionless and parent imports",()=>{const known=["src/main.js","src/lib/math.ts","shared/value.js"];assert.equal(resolveImportPath("src/main.js","./lib/math",known),"src/lib/math.ts");assert.equal(resolveImportPath("src/main.js","../shared/value.js",known),"shared/value.js");assert.equal(resolveImportPath("src/main.js","react",known),null);});
