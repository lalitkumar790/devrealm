const SOURCE_EXTENSIONS = new Set([".js",".jsx",".ts",".tsx",".py",".rs",".go",".java",".cpp",".c",".h",".hpp",".cs",".rb",".php",".swift",".kt",".vue",".svelte"]);
const ext = path => { const i=path.lastIndexOf("."); return i<0 ? "" : path.slice(i).toLowerCase(); };
export function analyzeTree(entries = []) {
 const files=entries.filter(item=>item.type==="blob"&&!item.path.startsWith(".git/"));
 const directories=new Map();
 for(const file of files){const parts=file.path.split("/");for(let i=1;i<parts.length;i++){const path=parts.slice(0,i).join("/");if(!directories.has(path))directories.set(path,{path,name:parts[i-1],parent:parts.slice(0,i-1).join("/"),files:0,sourceFiles:0,bytes:0});const dir=directories.get(path);dir.files++;dir.bytes+=file.size||0;if(SOURCE_EXTENSIONS.has(ext(file.path)))dir.sourceFiles++;}}
 const allDirectories=[...directories.values()].sort((a,b)=>a.path.localeCompare(b.path));
 const roots=allDirectories.filter(d=>!d.parent).sort((a,b)=>b.files-a.files);
 const topFiles=files.filter(f=>!f.path.includes("/")).sort((a,b)=>(b.size||0)-(a.size||0)).slice(0,18);
 const sourceCount=files.filter(f=>SOURCE_EXTENSIONS.has(ext(f.path))).length,extensionCounts={};
 for(const file of files){const e=ext(file.path)||"[no extension]";extensionCounts[e]=(extensionCounts[e]||0)+1;}
 return {totalFiles:files.length,sourceCount,directories:allDirectories,roots,topFiles,extensionCounts,files:files.slice(0,600)};
}
export function childrenAt(analysis,path="") {
 const prefix=path?path+"/":"";
 const directories=(analysis.directories||[]).filter(d=>d.parent===path);
 const files=(analysis.files||[]).filter(f=>{const rest=f.path.startsWith(prefix)?f.path.slice(prefix.length):"";return rest&&!rest.includes("/");});
 return {directories,files};
}
export function moduleForPath(path){const parts=path.split("/");return parts.length>1?parts[0]:"root";}
export function extractImportSpecifiers(source="",filePath="") {
 const found=new Set();
 const patterns=[
  /(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g,
  /require\(\s*["']([^"']+)["']\s*\)/g,
  /(?:^|\n)\s*from\s+([.\w]+)\s+import\s+/g,
  /(?:^|\n)\s*import\s+([.\w]+)\s*(?=$|,|\n)/g,
  /(?:^|\n)\s*use\s+((?:crate|self|super)::[\w:]+)[;{]/g,
  /(?:^|\n)\s*import\s*\(?\s*["']([^"']+)["']/g,
  /(?:^|\n)\s*import\s+([\w.]+);/g
 ];
 for(let i=0;i<patterns.length;i++){let match;while((match=patterns[i].exec(source))){const value=match[1];if(value.startsWith(".")||i>=2)found.add(value);}}
 return [...found];
}

export function resolveImportPath(fromPath,specifier,knownPaths=[]){
 const known=new Set(knownPaths),base=fromPath.split("/").slice(0,-1);
 let raw=specifier;
 if(raw.startsWith("crate::"))raw="src/"+raw.slice(7).replace(/::/g,"/");
 else if(raw.startsWith("self::"))raw=base.concat(raw.slice(6).split("::")).join("/");
 else if(raw.startsWith("super::"))raw=base.slice(0,-1).concat(raw.slice(7).split("::")).join("/");
 else if(raw.startsWith(".")){for(const part of raw.split("/")){if(!part||part===".")continue;if(part==="..")base.pop();else base.push(part);}raw=base.join("/");}
 else raw=raw.replace(/^\./,"").replace(/\./g,"/");
 const stem=raw.replace(/\.py$/,"").replace(/\.java$/,"").replace(/\.rs$/,"");
 const candidates=[raw,stem,stem+".js",stem+".jsx",stem+".ts",stem+".tsx",stem+".mjs",stem+".cjs",stem+".py",stem+"/__init__.py",stem+".rs",stem+"/mod.rs",stem+".java",stem+"/index.js",stem+"/index.ts",stem+"/index.tsx"];
 const match=candidates.find(path=>known.has(path));if(match)return match;
 const suffix=specifier.split("/").slice(-2).join("/");
 return knownPaths.find(path=>(path.startsWith(stem+"/")||path.startsWith(suffix+"/")||path.includes("/"+suffix+"/")||path.endsWith("/"+suffix+".go"))&&/\.(go|rs|py|java)$/.test(path))||null;
}

export function compareTrees(before,after){
 const oldFiles=new Map((before.files||[]).map(file=>[file.path,file]));
 const newFiles=new Map((after.files||[]).map(file=>[file.path,file]));
 const added=[],deleted=[],modified=[],unchanged=[];
 for(const [path,file] of newFiles){const previous=oldFiles.get(path);if(!previous)added.push(file);else if(previous.sha&&file.sha&&previous.sha!==file.sha)modified.push({before:previous,after:file});else unchanged.push(file);}
 for(const [path,file] of oldFiles)if(!newFiles.has(path))deleted.push(file);
 const oldDirs=new Set((before.directories||[]).map(dir=>dir.path)),newDirs=new Set((after.directories||[]).map(dir=>dir.path));
 const addedDirectories=[...newDirs].filter(path=>!oldDirs.has(path)),deletedDirectories=[...oldDirs].filter(path=>!newDirs.has(path));
 return {added,deleted,modified,unchanged,addedDirectories,deletedDirectories,counts:{added:added.length,deleted:deleted.length,modified:modified.length,unchanged:unchanged.length,addedDirectories:addedDirectories.length,deletedDirectories:deletedDirectories.length}};
}


export function createLineDiff(beforeText="",afterText="",options={}){
 const maxLines=options.maxLines||1200,maxCells=options.maxCells||1440000,maxOutput=options.maxOutput||500;
 const oldLines=beforeText.replace(/\r\n/g,"\n").split("\n"),newLines=afterText.replace(/\r\n/g,"\n").split("\n");
 let prefix=0;while(prefix<oldLines.length&&prefix<newLines.length&&oldLines[prefix]===newLines[prefix])prefix++;
 let suffix=0;while(suffix<oldLines.length-prefix&&suffix<newLines.length-prefix&&oldLines[oldLines.length-1-suffix]===newLines[newLines.length-1-suffix])suffix++;
 const a=oldLines.slice(prefix,oldLines.length-suffix),b=newLines.slice(prefix,newLines.length-suffix);
 if(oldLines.length>maxLines||newLines.length>maxLines||a.length*b.length>maxCells)return {truncated:true,lines:[],oldLineCount:oldLines.length,newLineCount:newLines.length,reason:"File is too large for an in-browser line diff."};
 const width=b.length+1,dp=new Uint32Array((a.length+1)*width);
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i*width+j]=a[i]===b[j]?dp[(i+1)*width+j+1]+1:Math.max(dp[(i+1)*width+j],dp[i*width+j+1]);
 const lines=[];let i=0,j=0,oldNo=1,newNo=1;
 const push=(type,line)=>{if(lines.length<maxOutput)lines.push({type,line,oldLine:type==="added"?null:oldNo,newLine:type==="removed"?null:newNo});if(type!=="added")oldNo++;if(type!=="removed")newNo++;};
 for(let k=0;k<prefix;k++)push("context",oldLines[k]);
 while(i<a.length&&j<b.length){if(a[i]===b[j]){push("context",a[i]);i++;j++;}else if(dp[(i+1)*width+j]>=dp[i*width+j+1]){push("removed",a[i++]);}else{push("added",b[j++]);}}
 while(i<a.length)push("removed",a[i++]);while(j<b.length)push("added",b[j++]);
 for(let k=suffix;k>0;k--)push("context",oldLines[oldLines.length-k]);
 const changed=lines.filter(line=>line.type!=="context").length;
 return {truncated:lines.length>=maxOutput,lines,oldLineCount:oldLines.length,newLineCount:newLines.length,added:lines.filter(x=>x.type==="added").length,removed:lines.filter(x=>x.type==="removed").length,changed};
}


export function analyzeArchitecture(analysis = {}) {
 const sampled = new Set(analysis.sampledSourcePaths || []);
 const nodes = [...sampled];
 const outgoing = new Map(nodes.map(path => [path, new Set()]));
 const incoming = new Map(nodes.map(path => [path, new Set()]));
 for (const link of analysis.relations || []) {
  if (!sampled.has(link.from) || !sampled.has(link.to)) continue;
  outgoing.get(link.from).add(link.to);
  incoming.get(link.to).add(link.from);
 }
 const metrics = nodes.map(path => {
  const outDegree = outgoing.get(path).size, inDegree = incoming.get(path).size;
  const base = path.split("/").pop().replace(/\.[^.]+$/, "").toLowerCase();
  const conventional = ["index","main","app","server","cli","__main__"].includes(base) || /(^|\/)main\.(rs|go|java)$/.test(path);
  return { path, inDegree, outDegree, degree: inDegree + outDegree, conventional };
 });
 const index = new Map(nodes.map((path, i) => [path, i]));
 const discovery = new Map(), low = new Map(), stack = [], onStack = new Set(), cycles = [];
 let sequence = 0;
 function visit(path) {
  discovery.set(path, sequence); low.set(path, sequence++); stack.push(path); onStack.add(path);
  for (const next of outgoing.get(path)) {
   if (!discovery.has(next)) { visit(next); low.set(path, Math.min(low.get(path), low.get(next))); }
   else if (onStack.has(next)) low.set(path, Math.min(low.get(path), discovery.get(next)));
  }
  if (low.get(path) === discovery.get(path)) {
   const component = []; let member;
   do { member = stack.pop(); onStack.delete(member); component.push(member); } while (member !== path);
   if (component.length > 1 || outgoing.get(path).has(path)) cycles.push(component.sort());
  }
 }
 for (const path of nodes) if (!discovery.has(path)) visit(path);
 const entryCandidates = metrics.filter(node => node.outDegree > 0 && (node.inDegree === 0 || node.conventional))
  .sort((a,b) => Number(b.conventional)-Number(a.conventional) || b.outDegree-a.outDegree).slice(0,8);
 const hubs = metrics.filter(node => node.degree >= 2).sort((a,b) => b.degree-a.degree).slice(0,8);
 const isolated = metrics.filter(node => node.degree === 0).slice(0,12);
 const modules = new Map();
 for (const node of metrics) {
  const module = node.path.includes("/") ? node.path.split("/")[0] : "(root)";
  if (!modules.has(module)) modules.set(module,{name:module,files:0,links:0});
  const item=modules.get(module);item.files++;item.links+=node.degree;
 }
 return { sampledFiles:nodes.length, resolvedLinks:[...outgoing.values()].reduce((sum,set)=>sum+set.size,0),
  entryCandidates, hubs, isolated, cycles, modules:[...modules.values()].sort((a,b)=>b.links-a.links||b.files-a.files),
  metrics, cycleFiles:new Set(cycles.flat()) };
}


export function traceDependencies(analysis = {}, targetPath = "") {
 const sampled = new Set(analysis.sampledSourcePaths || []);
 if (!sampled.has(targetPath)) return { target:targetPath, upstream:[], downstream:[], impacted:[], links:[], found:false };
 const outgoing = new Map([...sampled].map(path=>[path,new Set()]));
 const incoming = new Map([...sampled].map(path=>[path,new Set()]));
 for (const edge of analysis.relations || []) {
  if (!sampled.has(edge.from) || !sampled.has(edge.to)) continue;
  outgoing.get(edge.from).add(edge.to); incoming.get(edge.to).add(edge.from);
 }
 function walk(graph) {
  const seen=new Set(),queue=[targetPath];
  while(queue.length){const current=queue.shift();for(const next of graph.get(current)||[])if(!seen.has(next)){seen.add(next);queue.push(next);}}
  seen.delete(targetPath);return [...seen].sort();
 }
 const upstream=walk(incoming),downstream=walk(outgoing),impacted=[...new Set([targetPath,...upstream])].sort();
 const visible=new Set([targetPath,...upstream,...downstream]);
 const links=(analysis.relations||[]).filter(edge=>visible.has(edge.from)&&visible.has(edge.to)&&sampled.has(edge.from)&&sampled.has(edge.to));
 return {target:targetPath,upstream,downstream,impacted,links,found:true};
}


export function analyzeSymbols(sourceFiles = []) {
 const definitions=new Map();
 const patterns=[
  {kind:"function",re:/\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g},
  {kind:"class",re:/\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g},
  {kind:"function",re:/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g},
  {kind:"class",re:/\b(?:class|struct|trait|interface|enum)\s+([A-Za-z_$][\w$]*)/g},
  {kind:"function",re:/\b(?:def|fn|func)\s+([A-Za-z_$][\w$]*)/g}
 ];
 for(const file of sourceFiles){for(const pattern of patterns){pattern.re.lastIndex=0;let match;while((match=pattern.re.exec(file.source||""))){const name=match[1];if(!definitions.has(file.path+"::"+name))definitions.set(file.path+"::"+name,{name,kind:pattern.kind,definition:{path:file.path,line:(file.source.slice(0,match.index).match(/\n/g)||[]).length+1},references:[]});}}}
 const symbols=[...definitions.values()];
 for(const symbol of symbols){const re=new RegExp("\\b"+symbol.name+"\\b","g");for(const file of sourceFiles){if(file.path===symbol.definition.path)continue;re.lastIndex=0;let match;while((match=re.exec(file.source||""))){const line=(file.source.slice(0,match.index).match(/\n/g)||[]).length+1;if(!symbol.references.some(ref=>ref.path===file.path&&ref.line===line))symbol.references.push({path:file.path,line});}}}
 return symbols.map(symbol=>({...symbol,referenceCount:symbol.references.length})).sort((a,b)=>b.referenceCount-a.referenceCount||a.name.localeCompare(b.name));
}


function maskNonCode(source="") {
 const chars=[...source],masked=[...source];
 let quote=null,escaped=false,lineComment=false,blockComment=false;
 for(let i=0;i<chars.length;i++){
  const ch=chars[i],next=chars[i+1];
  if(lineComment){if(ch==="\\n")lineComment=false;else masked[i]=" ";continue;}
  if(blockComment){if(ch==="*"&&next==="/"){masked[i]=" ";masked[i+1]=" ";i++;blockComment=false;}else if(ch!=="\\n")masked[i]=" ";continue;}
  if(quote){if(ch!=="\\n")masked[i]=" ";if(escaped){escaped=false;continue;}if(ch==="\\\\"){escaped=true;continue;}if(ch===quote)quote=null;continue;}
  if(ch==="/"&&next==="/"){masked[i]=" ";masked[i+1]=" ";i++;lineComment=true;continue;}
  if(ch==="/"&&next==="*"){masked[i]=" ";masked[i+1]=" ";i++;blockComment=true;continue;}
  if(ch==="#"){masked[i]=" ";lineComment=true;continue;}
  if(ch==="'"||ch==='"'||ch==="\x60"){masked[i]=" ";quote=ch;continue;}
 }
 return masked.join("");
}

const CALL_KEYWORDS = new Set(["if","for","while","switch","catch","function","return","typeof","new","class","def","fn","func","with","super","this","print","require","import"]);
export function analyzeCallGraph(sourceFiles = []) {
 const symbols=analyzeSymbols(sourceFiles).filter(symbol=>symbol.kind==="function");
 const byName=new Map();
 for(const symbol of symbols){if(!byName.has(symbol.name))byName.set(symbol.name,[]);byName.get(symbol.name).push(symbol);}
 const edges=[],ambiguous=[];
 for(const file of sourceFiles){
  const source=file.source||"";
  const callPattern=/\b([A-Za-z_$][\w$]*)\s*\(/g;
  let match;
  while((match=callPattern.exec(code))){
   const name=match[1],candidates=byName.get(name)||[];
   if(CALL_KEYWORDS.has(name))continue;
   const line=(source.slice(0,match.index).match(/\n/g)||[]).length+1;
   const isDefinition=candidates.some(item=>item.definition.path===file.path&&item.definition.line===line);
   if(isDefinition||!candidates.length)continue;
   if(candidates.length>1){ambiguous.push({name,path:file.path,line,candidates:candidates.map(item=>item.definition)});continue;}
   const target=candidates[0];
   if(target.definition.path===file.path&&target.definition.line===line)continue;
   edges.push({from:{path:file.path,line},to:target.definition,name,confidence:"textual-candidate"});
  }
 }
 const unique=new Map();
 for(const edge of edges)unique.set([edge.from.path,edge.from.line,edge.to.path,edge.to.line].join("::"),edge);
 const resolved=[...unique.values()];
 const callers=new Map(symbols.map(item=>[item.definition.path+"::"+item.name,0]));
 for(const edge of resolved){const key=edge.to.path+"::"+edge.name;callers.set(key,(callers.get(key)||0)+1);}
 return {functions:symbols.length,edges:resolved,ambiguous,unresolvedCount:0,callers:[...callers].map(([key,count])=>({key,count})).sort((a,b)=>b.count-a.count)};
}
