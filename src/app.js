import { LANGUAGE_COLORS, SAMPLE_PROFILE, SAMPLE_REPOS } from "./data.js";
import { fetchDeveloper } from "./github.js";
import { createWorld, drawWorld, hitTest } from "./world.js";

const $ = id => document.getElementById(id);
const canvas=$("world"),ctx=canvas.getContext("2d");
let profile=SAMPLE_PROFILE,repositories=SAMPLE_REPOS,world=createWorld(repositories,profile.login),selected=null;
let view={x:0,y:0,zoom:1},drag=null,raf=0;

function resize(){
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);render();
}
function render(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>drawWorld(ctx,canvas.clientWidth,canvas.clientHeight,world,view,selected?.id));}
function fmt(n){return new Intl.NumberFormat().format(n||0);}
function renderProfile(){
  $("avatar").src=profile.avatar_url||"https://github.com/identicons/"+profile.login+".png";
  $("avatar").alt=(profile.name||profile.login)+" avatar";
  $("profile-name").textContent=profile.name||profile.login;
  $("profile-handle").textContent="@"+profile.login+" ↗";$("profile-handle").href=profile.html_url;
  $("profile-bio").textContent=profile.bio||"No public bio provided.";
  $("stat-repos").textContent=fmt(profile.public_repos??repositories.length);
  $("stat-followers").textContent=fmt(profile.followers);$("stat-following").textContent=fmt(profile.following);
}
function renderLanguages(){
  const counts=new Map();
  for(const repo of repositories){const name=repo.language||"Other";counts.set(name,(counts.get(name)||0)+1);}
  const total=repositories.length||1;
  $("language-list").innerHTML=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,7).map(([name,count])=>{
    const pct=Math.round(count/total*100),color=LANGUAGE_COLORS[name]||LANGUAGE_COLORS.Other;
    return `<div class="language-row"><span>${escapeHtml(name)}</span><div class="language-track"><div class="language-fill" style="width:${pct}%;background:${color}"></div></div><span class="language-pct">${pct}%</span></div>`;
  }).join("")||'<p class="muted">No public language metadata.</p>';
}
function renderRepos(){
  $("repo-list").innerHTML=repositories.slice(0,24).map(repo=>`<button class="repo-item" type="button" data-id="${repo.id}" aria-pressed="${selected?.id===repo.id}"><span><strong>${escapeHtml(repo.name)}</strong><small>${escapeHtml(repo.description||"No description")}</small></span><span class="repo-meta">★ ${fmt(repo.stargazers_count)}</span></button>`).join("")||'<p class="muted">No public repositories found.</p>';
  $("repo-list").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>selectRepo(repositories.find(r=>String(r.id)===button.dataset.id))));
}
function escapeHtml(value=""){return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
function selectRepo(repo){
  if(!repo)return;selected=repo;renderRepos();render();
  const language=repo.language||"Other";
  $("detail-content").innerHTML=`<h3 class="detail-name">${escapeHtml(repo.name)}</h3><p class="detail-description">${escapeHtml(repo.description||"No public description.")}</p><div class="detail-tags"><span class="detail-tag">${escapeHtml(language)}</span><span class="detail-tag">PRIMARY LANGUAGE</span></div><div class="detail-facts"><span>★ ${fmt(repo.stargazers_count)} STARS</span><span>⑂ ${fmt(repo.forks_count)} FORKS</span></div><a class="detail-link" href="${escapeHtml(repo.html_url)}" target="_blank" rel="noreferrer">OPEN REPOSITORY ↗</a>`;
}
function updateWorld(newProfile,newRepos){
  profile=newProfile;repositories=newRepos;selected=null;view={x:0,y:0,zoom:1};
  world=createWorld(repositories,profile.login);
  $("world-title").textContent=(profile.name||profile.login)+"'s Expanse";
  $("world-subtitle").textContent=`@ ${profile.login} · ${repositories.length} public owned repositories · generated just now`;
  $("repo-count").textContent=fmt(repositories.length);
  renderProfile();renderLanguages();renderRepos();render();
  $("detail-content").innerHTML='<div class="empty-inspector"><span>⌁</span><p>Select a structure on the map<br>or a repository in the list.</p></div>';
}
$("search-form").addEventListener("submit",async event=>{
  event.preventDefault();const username=$("username").value.trim(),button=$("generate");
  button.disabled=true;button.textContent="SCANNING…";$("status").textContent="Contacting GitHub's public API…";
  try{const data=await fetchDeveloper(username);updateWorld(data.profile,data.repositories);$("status").textContent=`World generated from ${data.repositories.length} public repositories.`;}
  catch(error){$("status").textContent=error.message;}
  finally{button.disabled=false;button.innerHTML='GENERATE <span>↗</span>';}
});
function zoomAt(factor){view.zoom=Math.max(.45,Math.min(2.5,view.zoom*factor));render();}
$("zoom-in").addEventListener("click",()=>zoomAt(1.2));$("zoom-out").addEventListener("click",()=>zoomAt(1/1.2));
$("reset-view").addEventListener("click",()=>{view={x:0,y:0,zoom:1};render();});
canvas.addEventListener("pointerdown",event=>{drag={x:event.clientX,y:event.clientY,moved:false};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener("pointermove",event=>{
  if(drag){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;if(drag.moved){view.x+=dx;view.y+=dy;drag.x=event.clientX;drag.y=event.clientY;render();}}
  const rect=canvas.getBoundingClientRect();$("map-coords").textContent=`X ${String(Math.round((event.clientX-rect.left)/2)).padStart(4,"0")} / Y ${String(Math.round((event.clientY-rect.top)/2)).padStart(4,"0")}`;
});
canvas.addEventListener("pointerup",event=>{if(drag&&!drag.moved){const repo=hitTest(canvas,world,view,event.clientX,event.clientY);if(repo)selectRepo(repo);}drag=null;});
canvas.addEventListener("pointercancel",()=>drag=null);
canvas.addEventListener("wheel",event=>{event.preventDefault();zoomAt(event.deltaY<0?1.08:1/1.08);},{passive:false});
new ResizeObserver(resize).observe(canvas);
updateWorld(profile,repositories);resize();
