/* MedFind - PWA with optional in-app barcode scanning (EAN-13)
 - Uses native BarcodeDetector when available (fast, modern)
 - Falls back to ZXing if BarcodeDetector not present
 - Barcode saved to IndexedDB as 'barcode' field
*/

const DB_NAME = 'medfind-db';
const STORE = 'meds';
let db;
let stream;
let scanning = false;
let codeReader;

function openDb(){
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => {
      const idb = rq.result;
      if(!idb.objectStoreNames.contains(STORE)){
        const store = idb.createObjectStore(STORE, {keyPath:'id', autoIncrement:true});
        store.createIndex('name', 'name', {unique:false});
        store.createIndex('compartment', 'compartment', {unique:false});
        store.createIndex('barcode', 'barcode', {unique:false});
      }
    }
    rq.onsuccess = () => { db = rq.result; res(db); }
    rq.onerror = () => rej(rq.error);
  });
}

function tx(storeName, mode='readonly'){
  const t = db.transaction(storeName, mode);
  return t.objectStore(storeName);
}

async function addMed(med){
  return new Promise((res, rej) => {
    const s = tx(STORE,'readwrite');
    const rq = s.add(med);
    rq.onsuccess = ()=> res(rq.result);
    rq.onerror = ()=> rej(rq.error);
  });
}
async function putMed(med){
  return new Promise((res, rej) => {
    const s = tx(STORE,'readwrite');
    const rq = s.put(med);
    rq.onsuccess = ()=> res(rq.result);
    rq.onerror = ()=> rej(rq.error);
  });
}
async function delMed(id){
  return new Promise((res, rej) => {
    const s = tx(STORE,'readwrite');
    const rq = s.delete(Number(id));
    rq.onsuccess = ()=> res();
    rq.onerror = ()=> rej(rq.error);
  });
}
async function getAllMeds(){
  return new Promise((res, rej) => {
    const s = tx(STORE,'readonly');
    const rq = s.getAll();
    rq.onsuccess = ()=> res(rq.result);
    rq.onerror = ()=> rej(rq.error);
  });
}
async function clearAll(){
  return new Promise((res, rej) => {
    const s = tx(STORE,'readwrite');
    const rq = s.clear();
    rq.onsuccess = ()=> res();
    rq.onerror = ()=> rej(rq.error);
  });
}

// Scanner helpers
async function startScanner() {
  const modal = document.getElementById('scannerModal');
  const video = document.getElementById('video');
  modal.style.display = 'flex';
  // Use BarcodeDetector if available
  if(window.BarcodeDetector && BarcodeDetector.getSupportedFormats){
    try{
      const formats = await BarcodeDetector.getSupportedFormats();
      // we'll try common formats including 'ean_13'
      const detector = new BarcodeDetector({formats: formats});
      stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
      video.srcObject = stream;
      scanning = true;
      const scanLoop = async ()=> {
        if(!scanning) return;
        try{
          const barcodes = await detector.detect(video);
          if(barcodes && barcodes.length){
            const code = barcodes[0].rawValue;
            finishScan(code);
            return;
          }
        }catch(e){}
        requestAnimationFrame(scanLoop);
      };
      scanLoop();
      return;
    }catch(e){
      // fallback below
    }
  }
  // Fallback: load ZXing Browser from CDN dynamically
  if(!window.ZXingLoaded){
    try{
      await loadScript('https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js');
      window.ZXingLoaded = true;
    }catch(e){
      alert('Camera scanner not available.');
      stopScanner();
      return;
    }
  }
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    video.srcObject = stream;
    scanning = true;
    const codeReaderLocal = new ZXing.BrowserMultiFormatReader();
    codeReader = codeReaderLocal;
    // try decode from video stream
    codeReader.decodeFromVideoDevice(null, video, (result, err) => {
      if(result){
        finishScan(result.getText());
      }
    });
  }catch(e){
    alert('Unable to access camera.');
    stopScanner();
  }
}

function stopScanner(){
  scanning = false;
  const modal = document.getElementById('scannerModal');
  modal.style.display = 'none';
  const video = document.getElementById('video');
  if(video && video.srcObject){
    const tracks = video.srcObject.getTracks();
    tracks.forEach(t=>t.stop());
    video.srcObject = null;
  }
  if(codeReader && codeReader.reset) try{ codeReader.reset(); }catch(e){}
}

function finishScan(code){
  stopScanner();
  const barcodeInput = document.getElementById('barcode');
  barcodeInput.value = code;
  alert('Scanned: ' + code);
}

// dynamic script loader
function loadScript(src){
  return new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = src; s.onload = ()=>res(); s.onerror = ()=>rej();
    document.head.appendChild(s);
  });
}

// UI wiring
document.addEventListener('DOMContentLoaded', async () => {
  await openDb();
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  const form = document.getElementById('medForm');
  const nameI = document.getElementById('name');
  const compI = document.getElementById('compartment');
  const barcodeI = document.getElementById('barcode');
  const idI = document.getElementById('medId');
  const list = document.getElementById('list');
  const search = document.getElementById('search');
  const exportBtn = document.getElementById('exportBtn');
  const importFile = document.getElementById('importFile');
  const clearBtn = document.getElementById('clearBtn');
  const clearAllBtn = document.getElementById('clearAll');
  const scanBtn = document.getElementById('scanBtn');
  const stopScan = document.getElementById('stopScan');

  async function refresh(q=''){
    const all = await getAllMeds();
    const s = q.trim().toLowerCase();
    const filtered = all.filter(item => {
      if(!s) return true;
      return (item.name||'').toLowerCase().includes(s)
          || (item.compartment||'').toLowerCase().includes(s)
          || (item.barcode||'').toLowerCase().includes(s);
    }).sort((a,b)=> (a.name||'').localeCompare(b.name||''));
    list.innerHTML = '';
    if(filtered.length===0){
      const li = document.createElement('li'); li.textContent='No medicines found.'; list.appendChild(li); return;
    }
    for(const it of filtered){
      const li = document.createElement('li');
      const left = document.createElement('div');
      left.innerHTML = `<strong>${escapeHtml(it.name)}</strong>
        <div class="item-meta">${escapeHtml(it.compartment)} ${it.barcode?(' • barcode: '+escapeHtml(it.barcode)):''}</div>`;
      const actions = document.createElement('div'); actions.className='actions';
      const editBtn = document.createElement('button'); editBtn.className='edit'; editBtn.textContent='Edit';
      const delBtn = document.createElement('button'); delBtn.className='del'; delBtn.textContent='Delete';
      editBtn.onclick = ()=> { idI.value=it.id; nameI.value=it.name; compI.value=it.compartment; barcodeI.value=it.barcode||''; nameI.focus(); }
      delBtn.onclick = async ()=> {
        if(confirm('Delete this entry?')){ await delMed(it.id); refresh(search.value); }
      }
      actions.appendChild(editBtn); actions.appendChild(delBtn);
      li.appendChild(left); li.appendChild(actions); list.appendChild(li);
    }
  }

  form.onsubmit = async (e)=>{
    e.preventDefault();
    const name = nameI.value.trim();
    const comp = compI.value.trim();
    const barcode = barcodeI.value.trim();
    if(!name || !comp) return alert('Please fill name and compartment');
    const id = idI.value;
    if(id){
      await putMed({id: Number(id), name, compartment: comp, barcode});
      idI.value=''; form.reset();
    } else {
      await addMed({name, compartment: comp, barcode});
      form.reset();
    }
    refresh(search.value);
  }

  clearBtn.onclick = ()=>{ document.getElementById('medId').value=''; form.reset(); }
  search.oninput = ()=> refresh(search.value);
  exportBtn.onclick = async ()=>{
    const all = await getAllMeds();
    if(all.length===0) return alert('No data to export');
    const csv = toCSV(all);
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='meds-export.csv'; a.click();
    URL.revokeObjectURL(url);
  }
  importFile.onchange = async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const txt = await f.text();
    const rows = parseCSV(txt);
    let count=0;
    for(const r of rows){
      if(!r.name || !r.compartment) continue;
      await addMed({name:r.name, compartment:r.compartment, barcode: r.barcode || ''}); count++;
    }
    alert(`Imported ${count} rows`);
    importFile.value='';
    refresh(search.value);
  }
  clearAllBtn.onclick = async ()=>{
    if(confirm('This will delete ALL entries. Continue?')){
      await clearAll(); refresh();
    }
  }

  scanBtn.onclick = ()=> startScanner();
  stopScan.onclick = ()=> stopScanner();

  // small helpers
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }
  function toCSV(arr){
    const hdr = ['id','name','compartment','barcode'];
    const lines = [hdr.join(',')];
    for(const r of arr) lines.push([r.id, `"${(r.name||'').replace(/"/g,'""')}"`, `"${(r.compartment||'').replace(/"/g,'""')}"`, `"${(r.barcode||'').replace(/"/g,'""')}"`].join(','));
    return lines.join('\n');
  }
  function parseCSV(text){
    const out=[];
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if(lines.length===0) return out;
    const headers = lines[0].split(',').map(h=>h.replace(/(^"|"$)/g,'').trim().toLowerCase());
    for(let i=1;i<lines.length;i++){
      const line = lines[i];
      const vals = [];
      let cur=''; let inq=false;
      for(let j=0;j<line.length;j++){
        const ch=line[j];
        if(ch=='"' && line[j+1]=='"'){ cur+='"'; j++; continue; }
        if(ch=='"'){ inq = !inq; continue; }
        if(ch==',' && !inq){ vals.push(cur); cur=''; continue; }
        cur += ch;
      }
      if(cur!=='') vals.push(cur);
      const obj={};
      for(let k=0;k<headers.length;k++) obj[headers[k]] = (vals[k]||'').replace(/^"|"$/g,'').trim();
      out.push(obj);
    }
    return out;
  }

  // initial load
  refresh();
});
