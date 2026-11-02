const API = "https://api.github.com";
const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };

async function request(path) {
  const response = await fetch(API + path, { headers });
  if (response.status === 404) throw new Error("That GitHub user or resource could not be found.");
  if (response.status === 403 || response.status === 429) throw new Error("GitHub's public API rate limit was reached. Try again later.");
  if (!response.ok) throw new Error(`GitHub returned an error (${response.status}). Please try again.`);
  return response.json();
}

export async function fetchDeveloper(username) {
  const clean = username.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(clean)) throw new Error("Enter a valid GitHub username.");
  const [profile, repositories] = await Promise.all([
    request(`/users/${encodeURIComponent(clean)}`),
    request(`/users/${encodeURIComponent(clean)}/repos?per_page=100&sort=updated&type=owner`)
  ]);
  const repos = repositories.filter(repo => !repo.fork).sort((a,b)=>b.stargazers_count-a.stargazers_count);
  return { profile, repositories: repos };
}

export async function fetchRecentCommits(username, repositories) {
  const candidates = repositories.slice(0, 6);
  const batches = await Promise.all(candidates.map(async repo => {
    try {
      const owner = repo.owner?.login || username;
      const commits = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}/commits?author=${encodeURIComponent(username)}&per_page=8`);
      return commits.map(item => ({
        sha: item.sha,
        message: item.commit?.message?.split("\n")[0] || "Commit",
        date: item.commit?.author?.date || item.commit?.committer?.date,
        repo: repo.name,
        url: item.html_url
      })).filter(item => item.date);
    } catch {
      return [];
    }
  }));
  return batches.flat().sort((a,b)=>new Date(b.date)-new Date(a.date));
}

export async function fetchRepositoryTree(repo, revision = repo.default_branch) {
  const owner=repo.owner?.login;
  const branch=revision;
  if(!owner || !branch) throw new Error("This repository has no accessible default branch.");
  const tree=await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const repositoryTools=await import("./repository.js");
  const analysis=repositoryTools.analyzeTree(tree.tree||[]);
  const sourceFiles=analysis.files.filter(file=>file.sha&&/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file.path)).slice(0,12);
  const knownPaths=analysis.files.map(file=>file.path);
  const relationBatches=await Promise.all(sourceFiles.map(async file=>{try{const blob=await request("/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repo.name)+"/git/blobs/"+file.sha);const binary=atob((blob.content||"").replace(/\s/g,""));const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));const source=new TextDecoder().decode(bytes);return repositoryTools.extractImportSpecifiers(source).map(specifier=>({from:file.path,to:repositoryTools.resolveImportPath(file.path,specifier,knownPaths),specifier})).filter(link=>link.to);}catch{return [];}}));
  const relations=relationBatches.flat();
  return {...analysis,relations,scannedSourceFiles:sourceFiles.length,truncated:Boolean(tree.truncated),branch};
}

export async function fetchRepositoryFile(repo,file) {
  if(!file?.sha) throw new Error("This file has no readable Git blob.");
  if((file.size||0)>80000) throw new Error("This file is larger than the 80 KB preview limit. Open it on GitHub instead.");
  const owner=repo.owner?.login;
  if(!owner) throw new Error("Repository owner information is unavailable.");
  const blob=await request("/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repo.name)+"/git/blobs/"+file.sha);
  if(blob.encoding!=="base64") throw new Error("GitHub returned an unsupported file encoding.");
  const binary=atob((blob.content||"").replace(/\s/g,""));
  const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  if(bytes.some(byte=>byte===0)) throw new Error("This appears to be a binary file. Open it on GitHub instead.");
  return new TextDecoder("utf-8",{fatal:false}).decode(bytes);
}

export async function fetchRepositoryHistory(repo, limit=30) {
  const owner=repo.owner?.login;
  if(!owner) throw new Error("Repository owner information is unavailable.");
  const commits=await request("/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repo.name)+"/commits?per_page="+Math.min(50,Math.max(1,limit)));
  return commits.map(item=>({sha:item.sha,tree:item.commit?.tree?.sha,date:item.commit?.author?.date||item.commit?.committer?.date,message:item.commit?.message?.split("\n")[0]||"Commit",url:item.html_url})).filter(item=>item.tree&&item.date);
}
