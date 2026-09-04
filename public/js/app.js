const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let selected=null,current=null;

$("#enter").onclick=()=>{$("#welcome").classList.add("hide");$("#app").classList.remove("hide")};
$("#menu").onclick=()=>{$("#drawer").classList.add("open");$("#shade").classList.remove("hide")};
$("#close").onclick=$("#shade").onclick=()=>{$("#drawer").classList.remove("open");$("#shade").classList.add("hide")};

$("#theme").onclick=()=>{
 document.body.classList.toggle("dark");
 $("#themeText").textContent=document.body.classList.contains("dark")?"Hitam":"Putih";
 localStorage.youdownTheme=document.body.classList.contains("dark")?"dark":"light";
};
if(localStorage.youdownTheme==="dark"){document.body.classList.add("dark");$("#themeText").textContent="Hitam"}

function modal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hide")}
$("#modalClose").onclick=()=>$("#modal").classList.add("hide");
$("#about").onclick=()=>{modal("<h3>YouDown</h3><p>YouDown Web v1.0</p><p>Downloader audio dan video dengan antarmuka sederhana.</p>");$("#drawer").classList.remove("open");$("#shade").classList.add("hide")};
$("#settings").onclick=()=>{modal('<h3>Setting</h3><p>Bahasa</p><button class="choice">Indonesia</button><button class="choice">English</button>');$("#drawer").classList.remove("open");$("#shade").classList.add("hide")};

$$(".fold").forEach(b=>b.onclick=()=>$("#"+b.dataset.target).classList.toggle("open"));

$("#render").onclick=async()=>{
 const url=$("#url").value.trim(); if(!url)return alert("Tempel link terlebih dahulu.");
 $("#render").disabled=true;$("#render").textContent="...";
 try{
  const r=await fetch("/api/render",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});
  const j=await r.json();if(!j.ok)throw Error(j.error);current=j.data;selected=null;
  $("#preview").innerHTML=current.thumbnail?`<img src="${esc(current.thumbnail)}"><div class="caption"><b>${esc(current.title)}</b><small>${esc(current.uploader)} · ${duration(current.duration)}</small></div>`:`<div class="empty">Preview tidak tersedia</div>`;
  $("#info").classList.remove("hide");$("#info").innerHTML=`<b>${esc(current.title)}</b><br><span>${esc(current.uploader)} · ${duration(current.duration)}</span>`;
  makeOptions("#videoBox",(current.qualities.length?current.qualities:[144,240,360,480,720,1080]).map(x=>[x+"p","video",x]));
  makeOptions("#audioBox",[[128,"audio",128],[160,"audio",160],[192,"audio",192],[256,"audio",256],[320,"audio",320]]);
  $("#download").disabled=true;$("#download").classList.remove("ready");$("#download").textContent="Pilih format download";
 }catch(e){alert(e.message)}
 $("#render").disabled=false;$("#render").textContent="RENDER";
};
function makeOptions(sel,arr){$(sel).innerHTML=arr.map(x=>`<button class="option" data-type="${x[1]}" data-q="${x[2]}">${x[0]}</button>`).join("");$$(sel+" .option").forEach(b=>b.onclick=()=>{ $$(".option").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");selected={type:b.dataset.type,quality:b.dataset.q};$("#download").disabled=false;$("#download").classList.add("ready");$("#download").textContent="DOWNLOAD "+b.textContent})}
$("#download").onclick=async()=>{
 if(!selected)return;$("#download").disabled=true;$("#status").textContent="Sedang memproses...";
 const r=await fetch("/api/download",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:$("#url").value.trim(),...selected})});
 const j=await r.json();if(!j.ok){$("#status").textContent=j.error;$("#download").disabled=false;return}
 let tries=0;const timer=setInterval(async()=>{tries++;const x=await fetch("/api/files").then(r=>r.json());if(x.data.length){clearInterval(timer);$("#status").textContent="Selesai.";renderFiles(x.data)}if(tries>100){clearInterval(timer);$("#status").textContent="Proses masih berjalan. Cek Hasil Download di bawah.";$("#download").disabled=false}},1500);
};
async function renderFiles(data){const box=$("#files");if(!data.length){box.innerHTML='<p class="muted">Belum ada hasil.</p>';return}box.innerHTML=data.map(x=>`<div class="file"><div class="filetop"><div class="filename">${esc(x.name)}</div><button class="more" data-name="${esc(x.name)}">⋮</button></div>${x.audio?`<audio class="player" controls src="${x.url}"></audio>`:`<video class="player" controls preload="metadata" src="${x.url}"></video>`}</div>`).join("");$$(".more").forEach(b=>b.onclick=()=>{const name=b.dataset.name;modal(`<h3>${esc(name)}</h3><button class="choice" id="share">Bagikan</button><button class="choice" id="del">Hapus</button>`);$("#share").onclick=async()=>{try{await navigator.share({title:"YouDown",url:location.origin+"/files/"+encodeURIComponent(name)})}catch{await navigator.clipboard.writeText(location.origin+"/files/"+encodeURIComponent(name));alert("Link disalin.")}$("#modal").classList.add("hide")};$("#del").onclick=async()=>{await fetch("/api/files/"+encodeURIComponent(name),{method:"DELETE"});$("#modal").classList.add("hide");loadFiles()}})}
async function loadFiles(){const x=await fetch("/api/files").then(r=>r.json());renderFiles(x.data)}
function duration(n){n=Number(n||0);if(!n)return"--";return Math.floor(n/60)+":"+String(Math.floor(n%60)).padStart(2,"0")}
function esc(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
loadFiles();
