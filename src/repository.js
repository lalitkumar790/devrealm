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
  /(?:^|\n)\s*import\s+([.\w]+)/g,
  /(?:^|\n)\s*use\s+((?:crate|self|super)::[\w:]+)[;{]/g,
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
 return knownPaths.find(path=>path.startsWith(stem+"/")&&/\.(go|rs|py|java)$/.test(path))||null;
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
