import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTree, moduleForPath, childrenAt, extractImportSpecifiers, resolveImportPath, compareTrees, createLineDiff } from "../src/repository.js";

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

test("compareTrees classifies added, deleted, modified and unchanged files",()=>{const before=analyzeTree([{path:"src/keep.js",type:"blob",size:10,sha:"same"},{path:"src/change.js",type:"blob",size:10,sha:"old"},{path:"gone.txt",type:"blob",size:2,sha:"gone"}]);const after=analyzeTree([{path:"src/keep.js",type:"blob",size:10,sha:"same"},{path:"src/change.js",type:"blob",size:12,sha:"new"},{path:"new.txt",type:"blob",size:3,sha:"new-file"},{path:"docs/guide.md",type:"blob",size:4,sha:"guide"}]);const diff=compareTrees(before,after);assert.deepEqual(diff.counts,{added:2,deleted:1,modified:1,unchanged:1,addedDirectories:1,deletedDirectories:0});assert.deepEqual(diff.added.map(file=>file.path).sort(),["docs/guide.md","new.txt"]);assert.equal(diff.deleted[0].path,"gone.txt");assert.equal(diff.modified[0].after.path,"src/change.js");});


test("createLineDiff labels changed lines and preserves line numbers",()=>{
 const diff=createLineDiff("alpha\nkeep\nold\nomega","alpha\nkeep\nnew\nomega");
 assert.equal(diff.added,1);assert.equal(diff.removed,1);
 assert.deepEqual(diff.lines.filter(x=>x.type!=="context").map(x=>[x.type,x.line]),[["removed","old"],["added","new"]]);
 assert.equal(diff.lines.find(x=>x.line==="new").newLine,3);
});
test("createLineDiff handles insertions, deletions and identical files",()=>{
 const inserted=createLineDiff("a\nc","a\nb\nc");assert.equal(inserted.added,1);assert.equal(inserted.removed,0);
 const deleted=createLineDiff("a\nb\nc","a\nc");assert.equal(deleted.removed,1);assert.equal(deleted.added,0);
 const same=createLineDiff("one\ntwo","one\ntwo");assert.equal(same.changed,0);
});
test("createLineDiff refuses oversized inputs without allocating a huge matrix",()=>{
 const diff=createLineDiff("a\nb","x\ny",{maxCells:1});assert.equal(diff.truncated,true);assert.equal(diff.lines.length,0);
});
