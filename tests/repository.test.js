import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTree, moduleForPath } from "../src/repository.js";

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
