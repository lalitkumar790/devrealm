const SOURCE_EXTENSIONS = new Set([".js",".jsx",".ts",".tsx",".py",".rs",".go",".java",".cpp",".c",".h",".hpp",".cs",".rb",".php",".swift",".kt",".vue",".svelte"]);
const ext = path => { const i=path.lastIndexOf("."); return i<0 ? "" : path.slice(i).toLowerCase(); };
export function analyzeTree(entries = []) {
  const files = entries.filter(item => item.type === "blob" && !item.path.startsWith(".git/"));
  const directories = new Map();
  for (const file of files) {
    const parts = file.path.split("/");
    for (let i=1;i<parts.length;i++) {
      const path=parts.slice(0,i).join("/");
      if (!directories.has(path)) directories.set(path,{path,name:parts[i-1],files:0,sourceFiles:0,bytes:0});
      const dir=directories.get(path); dir.files++; dir.bytes += file.size || 0;
      if (SOURCE_EXTENSIONS.has(ext(file.path))) dir.sourceFiles++;
    }
  }
  const roots=[...directories.values()].filter(d=>!d.path.includes("/")).sort((a,b)=>b.files-a.files);
  const topFiles=files.filter(f=>!f.path.includes("/")).sort((a,b)=>(b.size||0)-(a.size||0)).slice(0,18);
  const sourceCount=files.filter(f=>SOURCE_EXTENSIONS.has(ext(f.path))).length;
  const extensionCounts={};
  for(const file of files){const e=ext(file.path)||"[no extension]";extensionCounts[e]=(extensionCounts[e]||0)+1;}
  return {totalFiles:files.length,sourceCount,directories:[...directories.values()].sort((a,b)=>a.path.localeCompare(b.path)),roots,topFiles,extensionCounts,files:files.slice(0,600)};
}
export function moduleForPath(path) {
  const parts=path.split("/");
  return parts.length>1 ? parts[0] : "root";
}
