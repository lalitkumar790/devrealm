import { fetchDeveloper, fetchRecentCommits, fetchRepositoryTree } from "./github.js";
import { SAMPLE_PROFILE, SAMPLE_REPOS, LANGUAGE_COLORS } from "./data.js";
import { createUniverse } from "./scene3d.js";
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat().format(n||0);
let profile=SAMPLE_PROFILE,repositories=SAMPLE_REPOS,universe;
function pulse(repo){const age=repo.updated_at?Math.max(0,(Date.now()-new Date(repo.updated_at).getTime())/86400000):9999;return age<=30?"ACTIVE":age<=180?"COOLING":"DORMANT";}
function showRepo(repo){
 const color=LANGUAGE_COLORS[repo.language||"Other"]||LANGUAGE_COLORS.Other;
 $("detail-name").textContent=repo.name;$("detail-description").textContent=repo.description||"No public description for this repository.";
 $("planet-swatch").style.background=`radial-gradient(circle at 32% 28%,#fff,${color} 17%,#183747 53%,#050b14 80%)`;$("planet-swatch").style.boxShadow=`0 0 38px ${color}66,inset -10px -8px 16px #0009`;
 $("detail-tags").innerHTML=[repo.language||"Other",pulse(repo)].map(x=>`<span>${x}</span>`).join("");$("detail-facts").textContent=`★ ${fmt(repo.stargazers_count)} STARS     ⑂ ${fmt(repo.forks_count)} FORKS`;$("detail-link").href=repo.html_url;$("inspector").classList.add("open");
}
function renderProfile(){$("world-title").textContent=(profile.name||profile.login).toUpperCase()+"'S EXPANSE";$("world-subtitle").textContent="@"+profile.login+" · "+repositories.length+" public repositories";$("repo-count").textContent=String(repositories.length).padStart(2,"0");}
async function load(username){
 const button=$("generate");button.disabled=true;button.textContent="BUILDING…";$("status").textContent="Mapping repository systems into 3D space…";
 try{const data=await fetchDeveloper(username);profile=data.profile;repositories=data.repositories;renderProfile();universe.setRepositories(repositories,profile.login);$("status").textContent=`Universe formed from ${repositories.length} public repositories. Drag to orbit and click a planet.`;fetchRecentCommits(profile.login,repositories).then(commits=>{$("status").textContent+=` · ${commits.length} recent commit signals sampled.`;}).catch(()=>{});$("inspector").classList.remove("open");}
 catch(error){$("status").textContent=error.message;}finally{button.disabled=false;button.textContent="GENERATE WORLD ↗";}
}
$("search-form").addEventListener("submit",e=>{e.preventDefault();load($("username").value.trim());});
$("close-inspector").addEventListener("click",()=>$("inspector").classList.remove("open"));
$("reset-view").addEventListener("click",()=>universe.reset());let paused=false;$("toggle-motion").addEventListener("click",()=>{paused=!paused;universe.pause(paused);$("toggle-motion").textContent=paused?"▶ RESUME ORBIT":"Ⅱ PAUSE ORBIT";});
universe=createUniverse($("world"),showRepo);universe.setRepositories(repositories,profile.login);renderProfile();
