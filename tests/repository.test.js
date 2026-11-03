import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTree, moduleForPath, childrenAt, extractImportSpecifiers, resolveImportPath, compareTrees, createLineDiff, analyzeArchitecture, traceDependencies, analyzeSymbols, analyzeCallGraph } from "../src/repository.js";

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


test("extractImportSpecifiers recognises Python, Rust, Java and Go imports",()=>{
 const source=[
  "from app.services import worker",
  "import app.models",
  "use crate::engine::planner;",
  "import com.example.core.Engine;",
  'import "github.com/acme/project/internal/store"'
 ].join("\n");
 const refs=extractImportSpecifiers(source);
 assert.ok(refs.includes("app.services"));
 assert.ok(refs.includes("app.models"));
 assert.ok(refs.includes("crate::engine::planner"));
 assert.ok(refs.includes("com.example.core.Engine"));
 assert.ok(refs.includes("github.com/acme/project/internal/store"));
});
test("resolveImportPath maps language module names to local source files",()=>{
 const known=["app/services.py","app/models.py","src/engine/planner.rs","com/example/core/Engine.java","internal/store/store.go"];
 assert.equal(resolveImportPath("main.py","app.services",known),"app/services.py");
 assert.equal(resolveImportPath("src/main.rs","crate::engine::planner",known),"src/engine/planner.rs");
 assert.equal(resolveImportPath("Main.java","com.example.core.Engine",known),"com/example/core/Engine.java");
 assert.equal(resolveImportPath("main.go","github.com/acme/project/internal/store",known),"internal/store/store.go");
});


test("analyzeArchitecture identifies entry candidates, hubs, isolated files and modules",()=>{
 const result=analyzeArchitecture({sampledSourcePaths:["src/main.js","src/api.js","src/db.js","tools/orphan.py"],relations:[{from:"src/main.js",to:"src/api.js"},{from:"src/main.js",to:"src/db.js"},{from:"src/api.js",to:"src/db.js"}]});
 assert.ok(result.entryCandidates.some(node=>node.path==="src/main.js"));
 assert.ok(result.hubs.some(node=>node.path==="src/main.js"));
 assert.deepEqual(result.isolated.map(node=>node.path),["tools/orphan.py"]);
 assert.equal(result.resolvedLinks,3);
 assert.ok(result.modules.some(module=>module.name==="src"&&module.files===3));
});

test("analyzeArchitecture detects multi-file cycles and self loops",()=>{
 const result=analyzeArchitecture({sampledSourcePaths:["a.js","b.js","c.js","self.js","free.js"],relations:[{from:"a.js",to:"b.js"},{from:"b.js",to:"c.js"},{from:"c.js",to:"a.js"},{from:"self.js",to:"self.js"}]});
 assert.deepEqual(result.cycles.map(group=>group.length).sort(),[1,3]);
 assert.ok(result.cycleFiles.has("a.js"));
 assert.ok(result.cycleFiles.has("self.js"));
 assert.equal(result.cycles.length,2);
});

test("analyzeArchitecture ignores links outside the sampled graph",()=>{
 const result=analyzeArchitecture({sampledSourcePaths:["src/a.js"],relations:[{from:"src/a.js",to:"vendor/pkg.js"}]});
 assert.equal(result.resolvedLinks,0);
 assert.equal(result.isolated.length,1);
});

test("traceDependencies finds transitive upstream, downstream and impact paths",()=>{
 const analysis={sampledSourcePaths:["app.js","service.js","db.js","view.js","orphan.js"],relations:[{from:"app.js",to:"service.js"},{from:"service.js",to:"db.js"},{from:"view.js",to:"service.js"}]};
 const trace=traceDependencies(analysis,"service.js");
 assert.deepEqual(trace.upstream,["app.js","view.js"]);
 assert.deepEqual(trace.downstream,["db.js"]);
 assert.deepEqual(trace.impacted,["app.js","service.js","view.js"]);
 assert.equal(trace.links.length,3);
 assert.equal(trace.found,true);
});
test("traceDependencies handles unknown files and cycles without looping",()=>{
 const analysis={sampledSourcePaths:["a.js","b.js","c.js"],relations:[{from:"a.js",to:"b.js"},{from:"b.js",to:"a.js"},{from:"b.js",to:"c.js"}]};
 assert.equal(traceDependencies(analysis,"missing.js").found,false);
 const trace=traceDependencies(analysis,"a.js");
 assert.deepEqual(trace.upstream,["b.js"]);
 assert.deepEqual(trace.downstream,["b.js","c.js"]);
});

test("analyzeSymbols indexes declarations and cross-file references",()=>{
 const symbols=analyzeSymbols([
  {path:"src/service.js",source:"export function calculateTotal() { return 1; }"},
  {path:"src/app.js",source:"import { calculateTotal } from './service.js';\ncalculateTotal();"},
  {path:"src/model.py",source:"def build_model():\n pass"}
 ]);
 const total=symbols.find(item=>item.name==="calculateTotal");
 assert.equal(total.definition.path,"src/service.js");
 assert.equal(total.referenceCount,2);
 assert.ok(symbols.some(item=>item.name==="build_model"&&item.kind==="function"));
});


test("analyzeSymbols preserves same-named declarations in different files",()=>{
 const symbols=analyzeSymbols([
  {path:"src/a.js",source:"export function load() { return 1; }"},
  {path:"src/b.js",source:"export function load() { return 2; }"}
 ]);
 assert.equal(symbols.filter(item=>item.name==="load").length,2);
 assert.deepEqual(symbols.map(item=>item.definition.path).sort(),["src/a.js","src/b.js"]);
});

test("analyzeCallGraph resolves unique textual call candidates and reports ambiguous names",()=>{
 const graph=analyzeCallGraph([
  {path:"src/math.js",source:"export function calculate() { return 1; }"},
  {path:"src/app.js",source:"import { calculate } from './math.js';\nfunction run() { calculate(); }"}
 ]);
 assert.equal(graph.functions,2);
 assert.equal(graph.edges.length,1);
 assert.equal(graph.edges[0].name,"calculate");
 assert.equal(graph.edges[0].to.path,"src/math.js");
 const ambiguous=analyzeCallGraph([
  {path:"a.js",source:"function build() {}"},
  {path:"b.js",source:"function build() {}"},
  {path:"c.js",source:"build();"}
 ]);
 assert.equal(ambiguous.edges.length,0);
 assert.equal(ambiguous.ambiguous.length,1);
});
