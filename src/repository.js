const SOURCE_EXTENSIONS = new Set([".js",".jsx",".ts",".tsx",".py",".rs",".go",".java",".cpp",".c",".h",".hpp",".cs",".rb",".php",".swift",".kt",".vue",".svelte"]);
const ext = path => { const i=path.lastIndexOf("."); return i<0 ? "" : path.slice(i).toLowerCase(); };

export function compareRepositories(first = {}, second = {}) {
 const firstTopics=new Set(first.topics||[]),secondTopics=new Set(second.topics||[]);
 const sharedTopics=[...firstTopics].filter(topic=>secondTopics.has(topic)).sort();
 const firstOnlyTopics=[...firstTopics].filter(topic=>!secondTopics.has(topic)).sort();
 const secondOnlyTopics=[...secondTopics].filter(topic=>!firstTopics.has(topic)).sort();
 const metrics=["stargazers_count","forks_count","open_issues_count","size"];
 const values=Object.fromEntries(metrics.map(key=>[key,{first:Number(first[key]||0),second:Number(second[key]||0),delta:Number(second[key]||0)-Number(first[key]||0)}]));
 return {
  first:{name:first.name||first.full_name||"Repository A",fullName:first.full_name||first.name||"",language:first.language||"Other"},
  second:{name:second.name||second.full_name||"Repository B",fullName:second.full_name||second.name||"",language:second.language||"Other"},
  sameLanguage:(first.language||"Other")===(second.language||"Other"),
  sharedTopics,firstOnlyTopics,secondOnlyTopics,metrics:values,
  updatedAt:{first:first.updated_at||null,second:second.updated_at||null}
 };
}

export function matchesRepository(repo = {}, query = "") {
 const needle=String(query).trim().toLowerCase();
 if(!needle)return true;
 const searchable=[repo.name,repo.full_name,repo.description,repo.language,...(repo.topics||[])].filter(Boolean).join(" ").toLowerCase();
 return searchable.includes(needle);
}
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
  if(lineComment){if(ch==="\n")lineComment=false;else masked[i]=" ";continue;}
  if(blockComment){if(ch==="*"&&next==="/"){masked[i]=" ";masked[i+1]=" ";i++;blockComment=false;}else if(ch!=="\n")masked[i]=" ";continue;}
  if(quote){if(ch!=="\n")masked[i]=" ";if(escaped){escaped=false;continue;}if(ch==="\\"){escaped=true;continue;}if(ch===quote)quote=null;continue;}
  if(ch==="/"&&next==="/"){masked[i]=" ";masked[i+1]=" ";i++;lineComment=true;continue;}
  if(ch==="/"&&next==="*"){masked[i]=" ";masked[i+1]=" ";i++;blockComment=true;continue;}
  if(ch==="#"){masked[i]=" ";lineComment=true;continue;}
  if(ch==="'"||ch==='"'||ch==="\x60"){masked[i]=" ";quote=ch;continue;}
 }
 return masked.join("");
}

function findFunctionScopes(sourceFiles,symbols) {
 const scopes=[];
 for(const file of sourceFiles){
  const source=file.source||"",code=maskNonCode(source),lines=source.split("\n");
  for(const symbol of symbols.filter(item=>item.definition.path===file.path)){
   const startLine=symbol.definition.line,startOffset=lines.slice(0,startLine-1).reduce((sum,line)=>sum+line.length+1,0);
   const lineText=lines[startLine-1]||"",indent=(lineText.match(/^\s*/)||[""])[0].length;
   const python=/\.(py|rb)$/.test(file.path);
   let endLine=lines.length;
   if(python){
    for(let n=startLine;n<lines.length;n++){
     if(!lines[n].trim())continue;
     const currentIndent=(lines[n].match(/^\s*/)||[""])[0].length;
     if(currentIndent<=indent){endLine=n;break;}
    }
   }else{
    const open=code.indexOf("{",startOffset);
    if(open>=0){
     let depth=0,close=-1;
     for(let n=open;n<code.length;n++){if(code[n]==="{")depth++;else if(code[n]==="}"&&--depth===0){close=n;break;}}
     if(close>=0)endLine=(source.slice(0,close).match(/\n/g)||[]).length+1;
    }else{
     const next=symbols.filter(item=>item.definition.path===file.path&&item.definition.line>startLine).sort((a,b)=>a.definition.line-b.definition.line)[0];
     if(next)endLine=next.definition.line-1;
    }
   }
   scopes.push({path:file.path,startLine,endLine,definition:symbol.definition,name:symbol.name,span:endLine-startLine});
  }
 }
 return scopes;
}
function scopeAt(scopes,path,line) {
 return scopes.filter(scope=>scope.path===path&&scope.startLine<=line&&scope.endLine>=line).sort((a,b)=>a.span-b.span)[0]||null;
}

const CALL_KEYWORDS = new Set(["if","for","while","switch","catch","function","return","typeof","new","class","def","fn","func","with","super","this","print","require","import"]);
export function extractFunctionFlow(sourceFiles = [], target = {}) {
 const symbols=analyzeSymbols(sourceFiles).filter(item=>item.kind==="function");
 const scopes=findFunctionScopes(sourceFiles,symbols);
 const scope=scopes.find(item=>item.path===target.path&&item.startLine===target.line)||scopes.find(item=>item.path===target.path&&item.name===target.name);
 if(!scope)return {functionName:target.name||"unknown",path:target.path||"",startLine:target.line||1,steps:[],reason:"Function body could not be located in the sampled source."};
 const file=sourceFiles.find(item=>item.path===scope.path),lines=(file?.source||"").split("\n"),steps=[];
 const start=Math.max(0,scope.startLine-1),end=Math.min(lines.length,scope.endLine);
 for(let index=start;index<end;index++){
  const raw=lines[index],line=raw.trim();if(!line)continue;
  const code=maskNonCode(line).trim();if(!code||/^[{}()[\];,]+$/.test(code))continue;
  let kind="statement";
  if(/^(?:export\s+)?(?:async\s+)?function\b|^(?:const|let|var)\s+/.test(line)&&index===start)kind="declaration";
  else if(/\breturn\b/.test(code))kind="return";
  else if(/\bthrow\b/.test(code))kind="exception";
  else if(/\b(?:if|else\s+if|else|switch|case|match)\b/.test(code))kind="condition";
  else if(/\b(?:for|while|do)\b/.test(code))kind="loop";
  else if(/\bawait\b/.test(code))kind="await";
  else if(/\b(?:try|catch|finally)\b/.test(code))kind="exception";
  else if(/^(?:const|let|var)\s+/.test(code)||/^[A-Za-z_$][\w$.[\]]*\s*(?:\+\+|--|[+*/%-]?=(?!=))/.test(code))kind="assignment";
  const calls=[...code.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]).filter(name=>!CALL_KEYWORDS.has(name));
  steps.push({index:steps.length+1,line:index+1,kind,text:line.slice(0,240),calls});
 }
 return {functionName:scope.name,path:scope.path,startLine:scope.startLine,endLine:scope.endLine,steps,reason:steps.length?"":"No executable-looking statements were detected in this function body."};
}

export function analyzeVariableFlow(steps = []) {
 const variables=new Map(),edges=[],events=[];
 const identifier=/\b[A-Za-z_$][\w$]*\b/g;
 const reserved=new Set(["const","let","var","return","throw","if","else","for","while","await","async","new","true","false","null","undefined","this","function","try","catch","finally","switch","case","break","continue","typeof","instanceof","void","yield"]);
 for(const step of steps){
  const code=maskNonCode(step.text||"").trim();if(!code)continue;
  const declaration=code.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?:=\s*(.*))?/);
  const assignment=code.match(/^([A-Za-z_$][\w$]*)\s*(?:\+\+|--|[+*/%-]?=(?!=))\s*(.*)$/);
  const returned=code.match(/\breturn\s+([^;]+)/);
  let writes=[];
  if(declaration)writes=[declaration[1]];
  else if(assignment)writes=[assignment[1]];
  for(const name of writes){
   if(!variables.has(name))variables.set(name,{name,firstDefinedAt:step.line,lastUpdatedAt:step.line,writes:0,reads:0});
   const record=variables.get(name);record.lastUpdatedAt=step.line;record.writes++;
  }
  const expression=declaration?.[2]||assignment?.[2]||returned?.[1]||code;
  const called=new Set([...expression.matchAll(/\\b([A-Za-z_$][\\w$]*)\\s*\\(/g)].map(match=>match[1]));\n  const reads=[...new Set([...expression.matchAll(identifier)].map(match=>match[0]).filter(name=>!reserved.has(name)&&!writes.includes(name)&&!called.has(name)))];
  for(const name of reads){
   if(!variables.has(name))variables.set(name,{name,firstDefinedAt:null,lastUpdatedAt:null,writes:0,reads:0});
   variables.get(name).reads++;
   for(const written of writes)edges.push({from:written,to:name,line:step.line,kind:"data-use"});
  }
  events.push({step:step.index,line:step.line,kind:step.kind,writes,reads,returns:Boolean(returned),expression:expression.slice(0,180)});
 }
 return {variables:[...variables.values()],edges,events,metrics:{variables:variables.size,defined:[...variables.values()].filter(item=>item.firstDefinedAt!==null).length,unresolved:[...variables.values()].filter(item=>item.firstDefinedAt===null).length,reads:edges.length}};
}

export function analyzeCallGraph(sourceFiles = [], relations = []) {
 const symbols=analyzeSymbols(sourceFiles).filter(symbol=>symbol.kind==="function");
 const byName=new Map();
 for(const symbol of symbols){if(!byName.has(symbol.name))byName.set(symbol.name,[]);byName.get(symbol.name).push(symbol);}
 const importsByFile=new Map();
 for(const relation of relations){if(!relation?.from||!relation?.to)continue;if(!importsByFile.has(relation.from))importsByFile.set(relation.from,new Set());importsByFile.get(relation.from).add(relation.to);}
 const edges=[],ambiguous=[],scopes=findFunctionScopes(sourceFiles,symbols);
 for(const file of sourceFiles){
  const source=file.source||"",code=maskNonCode(source),imported=importsByFile.get(file.path)||new Set();
  const callPattern=/\b([A-Za-z_$][\w$]*)\s*\(/g;
  let match;
  while((match=callPattern.exec(code))){
   const name=match[1],candidates=byName.get(name)||[];
   if(CALL_KEYWORDS.has(name)||!candidates.length)continue;
   const line=(source.slice(0,match.index).match(/\n/g)||[]).length+1;
   const prefix=code.slice(Math.max(0,match.index-80),match.index);
   const isDefinition=/\b(?:function|def|fn|func)\s*$/.test(prefix);
   if(isDefinition)continue;
   const sameFile=candidates.filter(item=>item.definition.path===file.path);
   const importedCandidates=candidates.filter(item=>imported.has(item.definition.path));
   let target=null,confidence=null;
   if(sameFile.length===1){target=sameFile[0];confidence="same-file";}
   else if(sameFile.length>1){ambiguous.push({name,path:file.path,line,reason:"multiple same-file definitions",candidates:sameFile.map(item=>item.definition)});continue;}
   else if(importedCandidates.length===1){target=importedCandidates[0];confidence="import-aware-candidate";}
   else if(importedCandidates.length>1){ambiguous.push({name,path:file.path,line,reason:"multiple imported modules define this name",candidates:importedCandidates.map(item=>item.definition)});continue;}
   else if(candidates.length===1){target=candidates[0];confidence="textual-candidate";}
   else{ambiguous.push({name,path:file.path,line,reason:"no unique imported definition",candidates:candidates.map(item=>item.definition)});continue;}
   if(target.definition.path===file.path&&target.definition.line===line)continue;
   const caller=scopeAt(scopes,file.path,line);
   edges.push({from:{path:file.path,line,caller:caller?{name:caller.name,definition:caller.definition}:null},to:target.definition,name,confidence});
  }
 }
 const unique=new Map();
 for(const edge of edges)unique.set([edge.from.path,edge.from.line,edge.to.path,edge.to.line].join("::"),edge);
 const resolved=[...unique.values()];
 const functionEdgeMap=new Map();
 for(const edge of resolved){
  if(!edge.from.caller)continue;
  const key=[edge.from.caller.definition.path,edge.from.caller.definition.line,edge.to.path,edge.to.line].join("::");
  if(!functionEdgeMap.has(key))functionEdgeMap.set(key,{from:edge.from.caller,to:{name:edge.name,...edge.to},callSites:0,confidence:edge.confidence});
  functionEdgeMap.get(key).callSites++;
 }
 const callers=new Map(symbols.map(item=>[item.definition.path+"::"+item.name,0]));
 for(const edge of resolved){const key=edge.to.path+"::"+edge.name;callers.set(key,(callers.get(key)||0)+1);}
 return {functions:symbols.length,edges:resolved,functionEdges:[...functionEdgeMap.values()],ambiguous,unresolvedCount:0,callers:[...callers].map(([key,count])=>({key,count})).sort((a,b)=>b.count-a.count)};
}


export function traceFunctionImpact(graph={}, target={}) {
 const edges=graph.functionEdges||[];
 const keyOf=item=>item?(item.definition?item.definition.path+"::"+item.definition.line:item.path+"::"+item.line):null;
 const targetKey=target.path+"::"+target.line;
 const outgoing=new Map(),incoming=new Map();
 for(const edge of edges){
  const from=keyOf(edge.from),to=edge.to.path+"::"+edge.to.line;
  if(!outgoing.has(from))outgoing.set(from,[]);outgoing.get(from).push(edge.to);
  if(!incoming.has(to))incoming.set(to,[]);incoming.get(to).push(edge.from);
 }
 function walk(adjacency){
  const seen=new Map(),queue=[targetKey];
  while(queue.length){
   const current=queue.shift();
   for(const item of adjacency.get(current)||[]){
    const key=keyOf(item);
    if(key&&!seen.has(key)){seen.set(key,item);queue.push(key);}
   }
  }
  seen.delete(targetKey);
  return [...seen.values()];
 }
 const callers=walk(incoming),callees=walk(outgoing);
 return {target,callers,callees,impacted:[...new Map([[targetKey,{path:target.path,line:target.line}],...callers.map(item=>[keyOf(item),item.definition])]).values()],edges:edges.filter(edge=>{
  const visible=new Set([targetKey,...callers.map(keyOf),...callees.map(keyOf)]);
  return visible.has(keyOf(edge.from))&&visible.has(edge.to.path+"::"+edge.to.line);
 })};
}
