import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LANGUAGE_COLORS } from "./data.js";

export function createUniverse(canvas,onSelect){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x03060d);scene.fog=new THREE.FogExp2(0x03060d,.0017);
 const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,3000);camera.position.set(0,95,260);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.045;controls.minDistance=65;controls.maxDistance=650;controls.autoRotate=true;controls.autoRotateSpeed=.24;controls.target.set(0,0,0);
 scene.add(new THREE.AmbientLight(0x8095bb,.75));
 const key=new THREE.PointLight(0xb2ffe7,1800,650,2);key.position.set(0,45,0);scene.add(key);
 const fill=new THREE.PointLight(0x597be8,900,500,2);fill.position.set(-130,35,-120);scene.add(fill);
 const starGeo=new THREE.BufferGeometry(),starPositions=[];
 let seed=919;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<2600;i++){const r=450*Math.cbrt(rand()),a=rand()*Math.PI*2,z=(rand()-.5)*2;starPositions.push(r*Math.sqrt(1-z*z)*Math.cos(a),r*z,r*Math.sqrt(1-z*z)*Math.sin(a));}
 starGeo.setAttribute("position",new THREE.Float32BufferAttribute(starPositions,3));
 const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xa8c9dc,size:1.15,sizeAttenuation:true,transparent:true,opacity:.78}));scene.add(stars);
 const core=new THREE.Group();scene.add(core);
 const sun=new THREE.Mesh(new THREE.SphereGeometry(16,48,48),new THREE.MeshStandardMaterial({color:0x9cf3d7,emissive:0x287d70,emissiveIntensity:2.4,roughness:.35,metalness:.12}));core.add(sun);
 core.add(new THREE.Mesh(new THREE.SphereGeometry(20,40,40),new THREE.MeshBasicMaterial({color:0x64d9bd,transparent:true,opacity:.09,side:THREE.BackSide})));
 for(let r=36;r<=210;r+=35){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.045,4,180),new THREE.MeshBasicMaterial({color:0x6d9b9a,transparent:true,opacity:.18}));ring.rotation.x=Math.PI/2;core.add(ring);}
 const group=new THREE.Group();scene.add(group);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let planetMeshes=[],paused=false;
 function makeLabel(text,color){const c=document.createElement("canvas"),ctx=c.getContext("2d");c.width=512;c.height=96;ctx.font="500 34px monospace";ctx.textAlign="center";ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=12;ctx.fillText(text.slice(0,25),256,58);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));sprite.scale.set(35,6.6,1);return sprite;}
 function setRepositories(repos,login){
  while(group.children.length){const obj=group.children[group.children.length-1];group.remove(obj);obj.traverse?.(o=>{o.geometry?.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
  planetMeshes=[];seed=Array.from(login).reduce((a,c)=>Math.imul(a^c.charCodeAt(0),16777619)>>>0,2166136261);
  const sorted=[...repos].sort((a,b)=>(b.stargazers_count||0)-(a.stargazers_count||0));
  sorted.forEach((repo,i)=>{
   const angle=i*2.399963+rand()*.22,radius=40+Math.sqrt(i+1)*29+rand()*12,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius*.82,y=(rand()-.5)*23;
   const hex=LANGUAGE_COLORS[repo.language||"Other"]||LANGUAGE_COLORS.Other,color=new THREE.Color(hex),size=2.5+Math.min(5,Math.log2((repo.stargazers_count||0)+1)*.55);
   const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(size,3),new THREE.MeshStandardMaterial({color,roughness:.78,metalness:.08,emissive:color,emissiveIntensity:.13}));mesh.position.set(x,y,z);mesh.userData.repo=repo;group.add(mesh);planetMeshes.push(mesh);
   const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(size*1.16,24,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.11,side:THREE.BackSide}));mesh.add(atmosphere);
   const label=makeLabel(repo.name,"#d3e9e8");label.position.set(0,size+4,0);mesh.add(label);
   const orbit=new THREE.Mesh(new THREE.TorusGeometry(size+2,.08,4,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.48}));orbit.rotation.x=Math.PI/2;mesh.add(orbit);
   const moon=new THREE.Mesh(new THREE.SphereGeometry(.7,12,12),new THREE.MeshStandardMaterial({color:0xe7f4ed,emissive:color,emissiveIntensity:.35}));moon.position.set(size+3,1,0);mesh.add(moon);
   const age=repo.updated_at?Math.max(0,(Date.now()-new Date(repo.updated_at).getTime())/86400000):999;
   if(age<30){const halo=new THREE.Mesh(new THREE.TorusGeometry(size+4,.13,5,64),new THREE.MeshBasicMaterial({color:0x9df6d5,transparent:true,opacity:.7}));halo.rotation.x=Math.PI/2;mesh.add(halo);}
  });
  const linePositions=[];
  for(let i=0;i<planetMeshes.length;i++)for(let j=i+1;j<planetMeshes.length;j++){const a=planetMeshes[i],b=planetMeshes[j],ra=a.userData.repo,rb=b.userData.repo,shared=(ra.language&&ra.language===rb.language)||(ra.topics||[]).some(t=>(rb.topics||[]).includes(t));if(shared&&a.position.distanceTo(b.position)<125)linePositions.push(a.position.x,a.position.y,a.position.z,b.position.x,b.position.y,b.position.z);}
  if(linePositions.length){const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(linePositions,3));group.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x75d9c0,transparent:true,opacity:.19})));}
  const bounds=new THREE.Box3().setFromObject(group),sphere=bounds.getBoundingSphere(new THREE.Sphere());controls.target.set(0,0,0);camera.position.set(sphere.radius*.12,sphere.radius*.65,sphere.radius*2.3);controls.minDistance=Math.max(35,sphere.radius*.45);controls.maxDistance=Math.max(500,sphere.radius*6);controls.update();
 }
 function onPointer(event){const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(planetMeshes,false);if(hits.length){const mesh=hits[0].object;controls.target.copy(mesh.position);onSelect(mesh.userData.repo);}}
 renderer.domElement.addEventListener("click",onPointer);
 function animate(){requestAnimationFrame(animate);if(!paused){sun.rotation.y+=.0015;group.rotation.y+=.00012;stars.rotation.y+=.000015;}controls.update();renderer.render(scene,camera);}animate();
 function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}addEventListener("resize",resize);
 return {setRepositories,select(id){const mesh=planetMeshes.find(m=>String(m.userData.repo.id)===String(id));if(mesh){controls.target.copy(mesh.position);onSelect(mesh.userData.repo);}},reset(){controls.reset();controls.target.set(0,0,0);},pause(value){paused=value;controls.autoRotate=!value;}};
}
