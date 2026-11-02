import { LANGUAGE_COLORS } from "./data.js";

const TAU = Math.PI * 2;
const hash = value => {
  let h = 2166136261;
  for (const char of value) h = Math.imul(h ^ char.charCodeAt(0),16777619);
  return h >>> 0;
};
const randomFrom = seed => {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let t=value; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
};

export function createWorld(repositories, login="developer") {
  const rand = randomFrom(hash(login));
  const sorted = [...repositories].sort((a,b)=>(b.stargazers_count||0)-(a.stargazers_count||0));
  const points = sorted.map((repo,index)=>{
    const angle = index*2.3999632297 + rand()*.35;
    const radius = 55 + Math.sqrt(index+1)*48 + rand()*28;
    const languages = Object.keys(LANGUAGE_COLORS);
    const language = repo.language || "Other";
    return {repo,x:Math.cos(angle)*radius,y:Math.sin(angle)*radius*.69,rotation:rand()*TAU,
      size:Math.max(7,Math.min(18,8+Math.log2((repo.stargazers_count||0)+1)*1.1)),color:LANGUAGE_COLORS[language]||LANGUAGE_COLORS.Other,
      seed:rand(),isLandmark:index<3};
  });
  const links=[];
  for(let i=0;i<points.length;i++){
    for(let j=i+1;j<points.length;j++){
      const a=points[i],b=points[j],distance=Math.hypot(a.x-b.x,a.y-b.y);
      if(distance>285)continue;
      const sameLanguage=(a.repo.language||"Other")===(b.repo.language||"Other");
      const aTopics=new Set(a.repo.topics||[]);
      const sharedTopic=(b.repo.topics||[]).some(topic=>aTopics.has(topic));
      if((sameLanguage||sharedTopic)&&links.length<140)links.push({from:i,to:j,kind:sharedTopic?"topic":"language"});
    }
  }
  return {points,links,seed:hash(login),radius:Math.max(350,Math.sqrt(points.length)*170)};
}

function path(ctx, points) {
  ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.closePath();
}
function drawIsland(ctx,x,y,r,color,seed) {
  const rand=randomFrom(seed);
  const points=Array.from({length:13},(_,i)=>{
    const a=i/13*TAU, noise=.82+rand()*.3;
    return [x+Math.cos(a)*r*noise,y+Math.sin(a)*r*.72*noise];
  });
  path(ctx,points);ctx.fillStyle="#101f2a";ctx.fill();ctx.strokeStyle=color+"77";ctx.lineWidth=1.1;ctx.stroke();
  ctx.beginPath();ctx.ellipse(x,y,r*.67,r*.43,-.2,0,TAU);ctx.fillStyle="#162a32";ctx.fill();
  for(let i=0;i<6;i++){const a=rand()*TAU,d=rand()*r*.55;ctx.fillStyle=color+"50";ctx.fillRect(x+Math.cos(a)*d,y+Math.sin(a)*d*.65,2,2);}
}

export function drawWorld(ctx,width,height,world,view,selectedId) {
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle="#08111a";ctx.fillRect(0,0,width,height);
  const gradient=ctx.createRadialGradient(width*.52,height*.5,15,width*.52,height*.5,Math.max(width,height)*.72);
  gradient.addColorStop(0,"#14242c");gradient.addColorStop(1,"#08111a");ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  ctx.save();ctx.translate(width/2+view.x,height/2+view.y);ctx.scale(view.zoom,view.zoom);
  ctx.strokeStyle="#192e38";ctx.lineWidth=1/view.zoom;ctx.setLineDash([2,8]);
  for(let r=130;r<world.radius*1.5;r+=130){ctx.beginPath();ctx.ellipse(0,0,r,r*.69,0,0,TAU);ctx.stroke();}
  ctx.setLineDash([]);
  for(const link of world.links||[]){
    const a=world.points[link.from],b=world.points[link.to];
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
    ctx.strokeStyle=link.kind==="topic"?"#9df0d044":"#7894a033";
    ctx.lineWidth=link.kind==="topic"?1.3:0.8;ctx.setLineDash(link.kind==="topic"?[3,4]:[1,7]);ctx.stroke();
  }
  ctx.setLineDash([]);
  for(let i=0;i<world.points.length;i++){const p=world.points[i];drawIsland(ctx,p.x,p.y,25+p.size*1.7,p.color,world.seed+i);}
  for(const p of world.points){
    const active=String(p.repo.id)===String(selectedId);
    ctx.save();ctx.translate(p.x,p.y);
    if(active){ctx.beginPath();ctx.arc(0,0,p.size+13,0,TAU);ctx.strokeStyle="#e4fff4";ctx.lineWidth=1.5;ctx.stroke();}
    ctx.beginPath();ctx.arc(0,0,p.size+4,0,TAU);ctx.fillStyle=p.color+"19";ctx.fill();
    ctx.beginPath();ctx.arc(0,0,p.size,0,TAU);ctx.fillStyle=p.color;ctx.fill();
    ctx.beginPath();ctx.arc(-p.size*.25,-p.size*.25,p.size*.28,0,TAU);ctx.fillStyle="#ffffffaa";ctx.fill();
    if(p.isLandmark||active){ctx.font="10px 'DM Mono', monospace";ctx.textAlign="center";ctx.fillStyle=active?"#dffff4":"#a8bac5";ctx.fillText(p.repo.name.slice(0,22),0,p.size+19);}
    ctx.restore();
  }
  ctx.restore();
}

export function hitTest(canvas,world,view,clientX,clientY) {
  const rect=canvas.getBoundingClientRect(),x=(clientX-rect.left-rect.width/2-view.x)/view.zoom,y=(clientY-rect.top-rect.height/2-view.y)/view.zoom;
  let best=null,distance=Infinity;
  for(const p of world.points){const d=Math.hypot(p.x-x,p.y-y);if(d<p.size+12&&d<distance){best=p;distance=d;}}
  return best?.repo||null;
}
