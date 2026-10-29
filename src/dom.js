// DOM helpers shared by the interface modules.

const $=id=>document.getElementById(id);
function esc(t){return String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function saveFile(name,data,type){
  const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type}));
  const a=document.createElement('a'); a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
// A slider fills its rail up to the value (--p in style.css); call it again whenever code sets the value.
function fillRange(r){ const lo=+(r.min||0), hi=+(r.max||100); r.style.setProperty('--p',(r.value-lo)/((hi-lo)||1)*100+'%'); }
let toastTimer;
// "Title: detail" shows the short title on its own line above the detail
function toast(t){
  const el=$('toast'), msg=document.createElement('span'), i=t.indexOf(': ');
  msg.className='msg';
  if(i>0&&i<=40){ const tt=document.createElement('span'); tt.className='tt'; tt.textContent=t.slice(0,i); const d=t.slice(i+2); msg.append(tt,d.charAt(0).toUpperCase()+d.slice(1)); }
  else msg.textContent=t;
  el.replaceChildren(msg); el.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.hidden=true,2200); }

export { $, esc, fillRange, saveFile, toast };
