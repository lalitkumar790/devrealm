export const LANGUAGE_COLORS = {
  JavaScript: "#f0cf72", TypeScript: "#65a8dc", Python: "#78b7a0", Rust: "#d58c72",
  Go: "#70c3d0", "C++": "#9c91d7", C: "#a7b1b8", Java: "#dd9878", HTML: "#e58b68",
  CSS: "#8f9ce0", Shell: "#a8c27d", Ruby: "#db7777", Swift: "#e99e75", Kotlin: "#ad91de",
  PHP: "#a4a5df", Dart: "#78b9c9", "Jupyter Notebook": "#d8a16e", Other: "#8da4af"
};

export const SAMPLE_PROFILE = {
  login: "octocat", name: "The Octocat", bio: "A sample explorer", avatar_url: "https://github.com/octocat.png",
  html_url: "https://github.com/octocat", followers: 42, following: 9, public_repos: 8
};

export const SAMPLE_REPOS = [
  ["Spoon-Knife","HTML",4200,"This repo is for demonstration purposes."],
  ["Hello-World","",2100,"My first repository on GitHub!"],
  ["git-consortium","Ruby",760,"A sample collaborative project."],
  ["octocat.github.io","CSS",540,"A home for web experiments."],
  ["linguist","Ruby",330,"Language detection for GitHub repositories."],
  ["Spoon-Knife-2","JavaScript",180,"A small interactive experiment."],
  ["hello-world-python","Python",120,"Exploring Python."],
  ["world-builder","TypeScript",95,"Procedural world experiments."]
].map(([name,language,stargazers_count,description],i)=>({
  id:i+1,name,language:language||null,stargazers_count,description,html_url:"https://github.com/octocat/"+name,
  forks_count:Math.round(stargazers_count*.08),updated_at:new Date(Date.now()-i*86400000*7).toISOString(),size:120+i*73
}));
