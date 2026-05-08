// ── FORMULA SYSTEM ─────────────────────────────────────────────────────────────
// Full Excel-compatible formula engine with 80+ functions.
// Excel-like cell picking: click / drag cells while typing a formula.
// AI-assisted via Claude API (key stored in localStorage).

const FSTORE = {};
let _fpCell = null, _fpFkey = null, _pickerActive = false;

// ── Column helpers ─────────────────────────────────────────────────────────────
function _fColLetter(n) {
  let s = ''; while (n > 0) { s = String.fromCharCode(65 + (n-1)%26) + s; n = Math.floor((n-1)/26); } return s;
}
function _fColNum(col) {
  return col.toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

// ── Comprehensive formula function library ─────────────────────────────────────
const _F = {
  // Internal helpers
  _ref:   (cm, a)    => { const v = cm[a.toUpperCase()]; return v !== undefined ? v : 0; },
  _range: (cm, s, e) => {
    s = s.toUpperCase(); e = e.toUpperCase();
    const sc = _fColNum(s.match(/[A-Z]+/)[0]), sr = parseInt(s.match(/\d+/)[0]);
    const ec = _fColNum(e.match(/[A-Z]+/)[0]), er = parseInt(e.match(/\d+/)[0]);
    const minC = Math.min(sc,ec), maxC = Math.max(sc,ec), minR = Math.min(sr,er), maxR = Math.max(sr,er);
    const vals = [];
    for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) vals.push(cm[_fColLetter(c)+r] ?? 0);
    return vals;
  },
  _nums: (...a) => a.flat().map(parseFloat).filter(v => !isNaN(v)),

  // ── Math ──────────────────────────────────────────────────────────────────────
  ABS:       v => Math.abs(parseFloat(v)),
  CEILING:   (v, s=1) => Math.ceil(parseFloat(v)/parseFloat(s)) * parseFloat(s),
  FLOOR:     (v, s=1) => Math.floor(parseFloat(v)/parseFloat(s)) * parseFloat(s),
  INT:       v => Math.trunc(parseFloat(v)),
  MOD:       (v, d) => parseFloat(v) % parseFloat(d),
  POWER:     (b, e) => Math.pow(parseFloat(b), parseFloat(e)),
  SQRT:      v => Math.sqrt(Math.abs(parseFloat(v))),
  SIGN:      v => Math.sign(parseFloat(v)),
  LOG:       (v, base=10) => Math.log(Math.abs(parseFloat(v))) / Math.log(parseFloat(base)),
  LOG10:     v => Math.log10(Math.abs(parseFloat(v))),
  LN:        v => Math.log(Math.abs(parseFloat(v))),
  EXP:       v => Math.exp(parseFloat(v)),
  PI:        () => Math.PI,
  E:         () => Math.E,
  RAND:      () => Math.random(),
  RANDBETWEEN: (lo, hi) => Math.floor(Math.random()*(parseFloat(hi)-parseFloat(lo)+1)) + parseFloat(lo),
  ROUND:     (v, d=0) => Number(parseFloat(v).toFixed(parseInt(d))),
  ROUNDUP:   (v, d=0) => { const f=Math.pow(10,parseInt(d)); return Math.ceil(parseFloat(v)*f)/f; },
  ROUNDDOWN: (v, d=0) => { const f=Math.pow(10,parseInt(d)); return Math.floor(parseFloat(v)*f)/f; },
  TRUNC:     (v, d=0) => { const f=Math.pow(10,parseInt(d)); return Math.trunc(parseFloat(v)*f)/f; },
  EVEN:      v => { const n=Math.ceil(Math.abs(parseFloat(v))); return (n%2?n+1:n)*Math.sign(parseFloat(v)); },
  ODD:       v => { const n=Math.ceil(Math.abs(parseFloat(v))); return (n%2?n:n+1)*Math.sign(parseFloat(v)); },
  GCD:       (...a) => a.flat().map(Math.abs).reduce((g,v)=>{ while(v){[g,v]=[v,g%v];} return g; }),
  LCM:       (...a) => { const gcd=(x,y)=>{while(y){[x,y]=[y,x%y];}return x;}; return a.flat().reduce((l,v)=>Math.abs(l*v)/gcd(Math.abs(l),Math.abs(v)),1); },
  FACT:      v => { let n=parseInt(v),r=1; for(let i=2;i<=n;i++)r*=i; return r; },
  COMBIN:    (n,k) => { n=parseInt(n);k=parseInt(k); if(k>n)return 0; let r=1; for(let i=0;i<k;i++)r=r*(n-i)/(i+1); return Math.round(r); },
  PERMUT:    (n,k) => { n=parseInt(n);k=parseInt(k); let r=1; for(let i=0;i<k;i++)r*=(n-i); return r; },
  DEGREES:   v => parseFloat(v)*180/Math.PI,
  RADIANS:   v => parseFloat(v)*Math.PI/180,
  SIN:       v => Math.sin(parseFloat(v)), COS: v => Math.cos(parseFloat(v)), TAN: v => Math.tan(parseFloat(v)),
  ASIN:      v => Math.asin(parseFloat(v)), ACOS: v => Math.acos(parseFloat(v)), ATAN: v => Math.atan(parseFloat(v)),
  ATAN2:     (y,x) => Math.atan2(parseFloat(y),parseFloat(x)),
  SINH:      v => Math.sinh(parseFloat(v)), COSH: v => Math.cosh(parseFloat(v)), TANH: v => Math.tanh(parseFloat(v)),

  // ── Statistical ───────────────────────────────────────────────────────────────
  SUM:     (...a) => a.flat().reduce((s,v) => s+(parseFloat(v)||0), 0),
  AVERAGE: (...a) => { const n=a.flat().map(parseFloat).filter(v=>!isNaN(v)); return n.length ? n.reduce((s,v)=>s+v,0)/n.length : 0; },
  COUNT:   (...a) => a.flat().filter(v=>!isNaN(parseFloat(v))).length,
  COUNTA:  (...a) => a.flat().filter(v=>v!==null&&v!==undefined&&v!=='').length,
  MAX:     (...a) => Math.max(...a.flat().map(parseFloat).filter(v=>!isNaN(v))),
  MIN:     (...a) => Math.min(...a.flat().map(parseFloat).filter(v=>!isNaN(v))),
  LARGE:   (...a) => { const k=parseInt(a[a.length-1]); return a.slice(0,-1).flat().map(parseFloat).filter(v=>!isNaN(v)).sort((x,y)=>y-x)[k-1]??NaN; },
  SMALL:   (...a) => { const k=parseInt(a[a.length-1]); return a.slice(0,-1).flat().map(parseFloat).filter(v=>!isNaN(v)).sort((x,y)=>x-y)[k-1]??NaN; },
  MEDIAN:  (...a) => { const n=a.flat().map(parseFloat).filter(v=>!isNaN(v)).sort((x,y)=>x-y); const m=Math.floor(n.length/2); return n.length%2?n[m]:(n[m-1]+n[m])/2; },
  MODE:    (...a) => { const freq={}; a.flat().forEach(v=>{const k=parseFloat(v);freq[k]=(freq[k]||0)+1;}); return +Object.entries(freq).sort((x,y)=>y[1]-x[1])[0]?.[0]; },
  STDEV:   (...a) => { const n=a.flat().map(parseFloat).filter(v=>!isNaN(v)); if(n.length<2)return 0; const m=n.reduce((s,v)=>s+v,0)/n.length; return Math.sqrt(n.reduce((s,v)=>s+(v-m)**2,0)/(n.length-1)); },
  STDEVP:  (...a) => { const n=a.flat().map(parseFloat).filter(v=>!isNaN(v)); if(!n.length)return 0; const m=n.reduce((s,v)=>s+v,0)/n.length; return Math.sqrt(n.reduce((s,v)=>s+(v-m)**2,0)/n.length); },
  VAR:     (...a) => { const n=a.flat().map(parseFloat).filter(v=>!isNaN(v)); if(n.length<2)return 0; const m=n.reduce((s,v)=>s+v,0)/n.length; return n.reduce((s,v)=>s+(v-m)**2,0)/(n.length-1); },
  VARP:    (...a) => { const n=a.flat().map(parseFloat).filter(v=>!isNaN(v)); if(!n.length)return 0; const m=n.reduce((s,v)=>s+v,0)/n.length; return n.reduce((s,v)=>s+(v-m)**2,0)/n.length; },
  PERCENTILE: (arr, k) => { const n=[...arr].flat().map(parseFloat).filter(v=>!isNaN(v)).sort((a,b)=>a-b); const idx=parseFloat(k)*(n.length-1); const lo=Math.floor(idx); return n[lo]+(idx-lo)*((n[lo+1]??n[lo])-n[lo]); },
  QUARTILE: (arr, q) => { const qs=[0,0.25,0.5,0.75,1]; return _F.PERCENTILE(arr, qs[parseInt(q)]||0); },
  CORREL:   (a1, a2) => {
    const x=a1.flat().map(parseFloat),y=a2.flat().map(parseFloat),n=Math.min(x.length,y.length);
    const mx=x.slice(0,n).reduce((s,v)=>s+v,0)/n, my=y.slice(0,n).reduce((s,v)=>s+v,0)/n;
    const num=x.slice(0,n).reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0);
    const dx=Math.sqrt(x.slice(0,n).reduce((s,v)=>s+(v-mx)**2,0)), dy=Math.sqrt(y.slice(0,n).reduce((s,v)=>s+(v-my)**2,0));
    return dx&&dy ? num/(dx*dy) : 0;
  },
  SUMPRODUCT: (...arrays) => { const a=arrays.map(x=>x.flat().map(parseFloat)); const len=a[0]?.length||0; let s=0; for(let i=0;i<len;i++) s+=a.reduce((p,arr)=>p*(arr[i]||0),1); return s; },
  SUMIF: (range, criteria, sumRange) => {
    const r=range.flat(), s=(sumRange||range).flat();
    return r.reduce((tot,v,i) => {
      const n=parseFloat(v), crit=String(criteria).trim();
      const m=crit.match(/^([<>=!]{1,2})(-?[\d.]+)$/);
      const match = m ? (m[1]==='>'?n>+m[2]:m[1]==='<'?n<+m[2]:m[1]==='>='?n>=+m[2]:m[1]==='<='?n<=+m[2]:m[1]==='<>'||m[1]==='!='?n!=+m[2]:n===+m[2]) : (v==criteria);
      return tot + (match ? (parseFloat(s[i])||0) : 0);
    }, 0);
  },
  COUNTIF: (range, criteria) => {
    const r=range.flat();
    return r.filter(v => {
      const n=parseFloat(v), crit=String(criteria).trim();
      const m=crit.match(/^([<>=!]{1,2})(-?[\d.]+)$/);
      return m ? (m[1]==='>'?n>+m[2]:m[1]==='<'?n<+m[2]:m[1]==='>='?n>=+m[2]:m[1]==='<='?n<=+m[2]:m[1]==='<>'||m[1]==='!='?n!=+m[2]:n===+m[2]) : v==criteria;
    }).length;
  },
  AVERAGEIF: (range, criteria, avgRange) => {
    const r=range.flat(), a=(avgRange||range).flat();
    const matched=r.reduce((acc,v,i)=>{
      const n=parseFloat(v), crit=String(criteria).trim(), m=crit.match(/^([<>=!]{1,2})(-?[\d.]+)$/);
      const ok=m?(m[1]==='>'?n>+m[2]:m[1]==='<'?n<+m[2]:m[1]==='>='?n>=+m[2]:m[1]==='<='?n<=+m[2]:n!=+m[2]):(v==criteria);
      if(ok) acc.push(parseFloat(a[i])||0); return acc;
    },[]);
    return matched.length ? matched.reduce((s,v)=>s+v,0)/matched.length : 0;
  },

  // ── Logical ───────────────────────────────────────────────────────────────────
  IF:      (c, t, f=0) => c ? t : f,
  IFS:     (...a) => { for(let i=0;i<a.length-1;i+=2)if(a[i])return a[i+1]; return a[a.length-1]; },
  AND:     (...a) => a.flat().every(Boolean),
  OR:      (...a) => a.flat().some(Boolean),
  NOT:     v => !v,
  XOR:     (...a) => a.flat().filter(Boolean).length % 2 === 1,
  IFERROR: (val, errVal) => (val === null || (typeof val==='number' && !isFinite(val))) ? errVal : val,
  IFNA:    (val, naVal) => val ?? naVal,
  SWITCH:  (expr, ...a) => { for(let i=0;i<a.length-1;i+=2)if(expr==a[i])return a[i+1]; return a.length%2===0?a[a.length-1]:undefined; },
  TRUE:    () => true,
  FALSE:   () => false,

  // ── Financial ─────────────────────────────────────────────────────────────────
  NPV: (rate, ...cashflows) => {
    rate = parseFloat(rate);
    return cashflows.flat().reduce((pv, cf, i) => pv + parseFloat(cf) / Math.pow(1 + rate, i + 1), 0);
  },

  IRR: (cashflows, guess=0.1) => {
    const vals = cashflows.flat().map(parseFloat);
    if (!vals.length) return NaN;
    const npv  = r => vals.reduce((s,v,i) => s + v/Math.pow(1+r,i), 0);
    const dnpv = r => vals.reduce((s,v,i) => i ? s - i*v/Math.pow(1+r,i+1) : s, 0);
    let rate = parseFloat(guess)||0.1;
    for (let i=0; i<300; i++) {
      const n=npv(rate), d=dnpv(rate); if(Math.abs(d)<1e-14) break;
      const nr=rate-n/d; if(Math.abs(nr-rate)<1e-10){rate=nr;break;} rate=Math.max(-0.9999,nr);
    }
    return rate;
  },

  XIRR: (cashflows, dates, guess=0.1) => {
    const vals=cashflows.flat().map(parseFloat), dts=dates.flat().map(parseFloat);
    if(vals.length!==dts.length||!vals.length) return NaN;
    const d0=dts[0];
    const npv  = r => vals.reduce((s,v,i) => s + v/Math.pow(1+r,(dts[i]-d0)/365), 0);
    const dnpv = r => vals.reduce((s,v,i) => { const t=(dts[i]-d0)/365; return s - t*v/Math.pow(1+r,t+1); }, 0);
    let rate=parseFloat(guess)||0.1;
    for(let i=0;i<300;i++){
      const n=npv(rate),d=dnpv(rate); if(Math.abs(d)<1e-14)break;
      const nr=rate-n/d; if(Math.abs(nr-rate)<1e-10){rate=nr;break;} rate=Math.max(-0.9999,nr);
    }
    return rate;
  },

  PMT: (rate, nper, pv, fv=0, type=0) => {
    rate=parseFloat(rate); nper=parseFloat(nper); pv=parseFloat(pv); fv=parseFloat(fv)||0; type=parseFloat(type)||0;
    if(Math.abs(rate)<1e-10) return -(pv+fv)/nper;
    const pvif=Math.pow(1+rate,nper);
    return -rate*(pv*pvif+fv)/((1+rate*type)*(pvif-1));
  },

  PV: (rate, nper, pmt, fv=0, type=0) => {
    rate=parseFloat(rate); nper=parseFloat(nper); pmt=parseFloat(pmt); fv=parseFloat(fv)||0; type=parseFloat(type)||0;
    if(Math.abs(rate)<1e-10) return -pmt*nper-fv;
    const pvif=Math.pow(1+rate,nper);
    return -(fv+pmt*(1+rate*type)*(pvif-1)/rate)/pvif;
  },

  FV: (rate, nper, pmt, pv=0, type=0) => {
    rate=parseFloat(rate); nper=parseFloat(nper); pmt=parseFloat(pmt); pv=parseFloat(pv)||0; type=parseFloat(type)||0;
    if(Math.abs(rate)<1e-10) return -pv-pmt*nper;
    const pvif=Math.pow(1+rate,nper);
    return -(pv*pvif+pmt*(1+rate*type)*(pvif-1)/rate);
  },

  NPER: (rate, pmt, pv, fv=0, type=0) => {
    rate=parseFloat(rate); pmt=parseFloat(pmt); pv=parseFloat(pv); fv=parseFloat(fv)||0; type=parseFloat(type)||0;
    if(Math.abs(rate)<1e-10) return -(pv+fv)/pmt;
    const k=pmt*(1+rate*type)/rate;
    return Math.log((k-fv)/(k+pv))/Math.log(1+rate);
  },

  RATE: (nper, pmt, pv, fv=0, type=0, guess=0.1) => {
    nper=parseFloat(nper); pmt=parseFloat(pmt); pv=parseFloat(pv); fv=parseFloat(fv)||0; type=parseFloat(type)||0;
    let rate=parseFloat(guess)||0.1;
    for(let i=0;i<300;i++){
      const pvif=Math.pow(1+rate,nper);
      const f=pv*pvif+pmt*(1+rate*type)*(pvif-1)/rate+fv;
      const df=nper*pv*Math.pow(1+rate,nper-1)+pmt*(1+rate*type)*(nper*Math.pow(1+rate,nper-1)/rate-(pvif-1)/(rate*rate));
      if(Math.abs(df)<1e-14)break; const nr=rate-f/df; if(Math.abs(nr-rate)<1e-10){rate=nr;break;} rate=nr;
    }
    return rate;
  },

  MIRR: (cashflows, financeRate, reinvestRate) => {
    const vals=cashflows.flat().map(parseFloat); const n=vals.length;
    financeRate=parseFloat(financeRate); reinvestRate=parseFloat(reinvestRate);
    const pv=Math.abs(vals.reduce((s,v,i)=>v<0?s+v/Math.pow(1+financeRate,i):s,0));
    const fv=vals.reduce((s,v,i)=>v>0?s+v*Math.pow(1+reinvestRate,n-1-i):s,0);
    if(!pv||!fv) return NaN;
    return Math.pow(fv/pv,1/(n-1))-1;
  },

  IPMT: (rate, per, nper, pv, fv=0, type=0) => {
    rate=parseFloat(rate); per=parseInt(per); nper=parseFloat(nper); pv=parseFloat(pv); fv=parseFloat(fv)||0; type=parseFloat(type)||0;
    const pmt=_F.PMT(rate,nper,pv,fv,type);
    if(per===1) return type===0?-pv*rate:0;
    const fv1=_F.FV(rate,per-1,pmt,pv,type);
    return type===0?-fv1*rate:-(fv1+pmt)*rate;
  },

  PPMT: (rate, per, nper, pv, fv=0, type=0) => _F.PMT(rate,nper,pv,fv,type) - _F.IPMT(rate,per,nper,pv,fv,type),

  SLN:  (cost, salvage, life) => (parseFloat(cost)-parseFloat(salvage))/parseFloat(life),
  SYD:  (cost, salvage, life, per) => { const n=parseFloat(life); return (parseFloat(cost)-parseFloat(salvage))*(n-parseFloat(per)+1)/(n*(n+1)/2); },
  DB:   (cost, salvage, life, period, month=12) => {
    cost=parseFloat(cost); salvage=parseFloat(salvage); life=parseFloat(life); period=parseFloat(period); month=parseFloat(month);
    const rate=1-Math.pow(salvage/cost,1/life);
    let book=cost; let dep=0;
    for(let i=1;i<=period;i++){
      dep = i===1 ? book*rate*month/12 : (i===life+1?book*rate*(12-month)/12:book*rate);
      book-=dep;
    }
    return dep;
  },
  DDB:  (cost, salvage, life, period, factor=2) => {
    cost=parseFloat(cost); salvage=parseFloat(salvage); life=parseFloat(life); period=parseFloat(period); factor=parseFloat(factor);
    const rate=factor/life; let book=cost;
    for(let i=1;i<period;i++) book-=Math.min(book*rate,book-salvage);
    return Math.min(book*rate,book-salvage);
  },

  // ── Lookup ────────────────────────────────────────────────────────────────────
  VLOOKUP: (lookupVal, tableArr, colIndex, rangeLookup=true) => {
    const data=tableArr.flat(1); if(!data.length) return NaN;
    // tableArr is flat — reconstruct rows by treating every nth element as a row
    // For simplicity: tableArr passed as single flat array; use MATCH + INDEX instead for 2D
    const col=parseInt(colIndex)-1;
    lookupVal=isNaN(parseFloat(lookupVal))?String(lookupVal):parseFloat(lookupVal);
    if(rangeLookup) {
      let res=NaN; for(const v of data){ const rv=isNaN(parseFloat(v))?v:parseFloat(v); if(rv<=lookupVal)res=v; else break; } return res;
    }
    return data.find(v=>(isNaN(parseFloat(v))?v:parseFloat(v))==lookupVal) ?? NaN;
  },
  MATCH: (lookupVal, arr, matchType=1) => {
    const flat=arr.flat(); lookupVal=isNaN(parseFloat(lookupVal))?String(lookupVal):parseFloat(lookupVal);
    if(matchType===0){ const i=flat.findIndex(v=>(isNaN(parseFloat(v))?v:parseFloat(v))==lookupVal); return i<0?NaN:i+1; }
    if(matchType===1){ let i=flat.length-1; while(i>=0&&(isNaN(parseFloat(flat[i]))?flat[i]:parseFloat(flat[i]))>lookupVal)i--; return i+1||NaN; }
    if(matchType===-1){ let i=0; while(i<flat.length&&(isNaN(parseFloat(flat[i]))?flat[i]:parseFloat(flat[i]))<lookupVal)i++; return i+1||NaN; }
    return NaN;
  },
  INDEX: (arr, rowNum, colNum=1) => {
    const flat=arr.flat(); const i=parseInt(rowNum)-1; return flat[i]??NaN;
  },
  CHOOSE: (n, ...vals) => vals.flat()[parseInt(n)-1] ?? NaN,
  OFFSET: (ref, rows, cols) => ref, // stub; requires positional context

  // ── Text ──────────────────────────────────────────────────────────────────────
  LEN:         v => String(v).length,
  LEFT:        (v, n=1) => String(v).slice(0, parseInt(n)),
  RIGHT:       (v, n=1) => String(v).slice(-Math.max(0,parseInt(n))),
  MID:         (v, s, n) => String(v).slice(parseInt(s)-1, parseInt(s)-1+parseInt(n)),
  UPPER:       v => String(v).toUpperCase(),
  LOWER:       v => String(v).toLowerCase(),
  PROPER:      v => String(v).replace(/\b\w/g, c=>c.toUpperCase()),
  TRIM:        v => String(v).trim().replace(/\s+/g,' '),
  REPT:        (v, n) => String(v).repeat(parseInt(n)),
  CONCATENATE: (...a) => a.flat().join(''),
  CONCAT:      (...a) => a.flat().join(''),
  TEXTJOIN:    (d, ig, ...a) => a.flat().filter(v=>!ig||v!=='').join(d),
  TEXT:        (v, fmt) => { const n=parseFloat(v); if(isNaN(n)) return String(v); const d=(fmt.match(/\.(\d+)$/))?.[1]??'2'; return n.toFixed(parseInt(d)); },
  VALUE:       v => parseFloat(String(v).replace(/,/g,'')),
  CHAR:        n => String.fromCharCode(parseInt(n)),
  CODE:        v => String(v).charCodeAt(0),
  FIND:        (f, t, s=1) => { const i=String(t).indexOf(String(f),parseInt(s)-1); return i<0?NaN:i+1; },
  SEARCH:      (f, t, s=1) => { const i=String(t).toLowerCase().indexOf(String(f).toLowerCase(),parseInt(s)-1); return i<0?NaN:i+1; },
  SUBSTITUTE:  (t, o, nw, n) => { let cnt=0; return String(t).replace(new RegExp(String(o).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'), m=>(!n||++cnt===parseInt(n))?String(nw):m); },
  REPLACE:     (t, s, n, nw) => String(t).slice(0,parseInt(s)-1)+String(nw)+String(t).slice(parseInt(s)-1+parseInt(n)),
  EXACT:       (a, b) => String(a)===String(b) ? 1 : 0,
  DOLLAR:      (v, d=2) => '$'+parseFloat(v).toFixed(parseInt(d)),
  NUMBERVALUE: (v, ds='.', gs=',') => parseFloat(String(v).replace(new RegExp('['+gs+']','g'),'').replace(ds,'.')),

  // ── Date ──────────────────────────────────────────────────────────────────────
  TODAY:   () => Math.floor(Date.now()/86400000)+25569,
  NOW:     () => Date.now()/86400000+25569,
  YEAR:    v => new Date(Math.round((parseFloat(v)-25569)*86400000)).getFullYear(),
  MONTH:   v => new Date(Math.round((parseFloat(v)-25569)*86400000)).getMonth()+1,
  DAY:     v => new Date(Math.round((parseFloat(v)-25569)*86400000)).getDate(),
  HOUR:    v => new Date(Math.round((parseFloat(v)-25569)*86400000)).getHours(),
  MINUTE:  v => new Date(Math.round((parseFloat(v)-25569)*86400000)).getMinutes(),
  SECOND:  v => new Date(Math.round((parseFloat(v)-25569)*86400000)).getSeconds(),
  DATE:    (y,m,d) => Math.floor(new Date(parseInt(y),parseInt(m)-1,parseInt(d)).getTime()/86400000)+25569,
  TIME:    (h,m,s) => (parseInt(h)*3600+parseInt(m)*60+parseInt(s))/86400,
  DAYS:    (e,s) => parseFloat(e)-parseFloat(s),
  DAYS360: (s,e) => Math.round((parseFloat(e)-parseFloat(s))*360/365),
  EDATE:   (s,m) => { const d=new Date(Math.round((parseFloat(s)-25569)*86400000)); d.setMonth(d.getMonth()+parseInt(m)); return Math.floor(d.getTime()/86400000)+25569; },
  EOMONTH: (s,m) => { const d=new Date(Math.round((parseFloat(s)-25569)*86400000)); d.setMonth(d.getMonth()+parseInt(m)+1,0); return Math.floor(d.getTime()/86400000)+25569; },
  WEEKDAY: (v,r=1) => { const d=new Date(Math.round((parseFloat(v)-25569)*86400000)).getDay(); return r===2?(d===0?7:d):d+1; },
  NETWORKDAYS: (s,e) => { const days=Math.round(Math.abs(parseFloat(e)-parseFloat(s))); return Math.ceil(days*5/7)*(parseFloat(e)>=parseFloat(s)?1:-1); },
  YEARFRAC: (s,e) => Math.abs(parseFloat(e)-parseFloat(s))/365,

  // ── Type/check ────────────────────────────────────────────────────────────────
  ISNUMBER: v => !isNaN(parseFloat(v)) && isFinite(parseFloat(v)) ? 1 : 0,
  ISTEXT:   v => (isNaN(parseFloat(v)) && typeof v==='string') ? 1 : 0,
  ISBLANK:  v => (v===null||v===undefined||v===''||v===0) ? 1 : 0,
  ISERROR:  v => (!isFinite(parseFloat(v))||isNaN(parseFloat(v))) ? 1 : 0,
  ISNA:     v => v!==v ? 1 : 0,
  N:        v => parseFloat(v)||0,
  T:        v => isNaN(parseFloat(v)) ? String(v) : '',
  TYPE:     v => isNaN(parseFloat(v)) ? (typeof v==='string'?2:16) : 1,
};
// Aliases
_F.AVG = _F.AVERAGE; _F.STDEVS = _F.STDEV; _F.VARS = _F.VAR;
_F.XNPV = (rate, cashflows, dates) => dates.flat().reduce((s,d,i)=>s+(cashflows.flat()[i]||0)/Math.pow(1+parseFloat(rate),(d-dates.flat()[0])/365), 0);

// ── Assign data-caddr to every th/td after render ─────────────────────────────
function assignCellAddrs() {
  try {
    document.querySelectorAll('table').forEach(table => {
      Array.from(table.querySelectorAll('tr')).forEach((tr, rIdx) => {
        let pos = 1;
        Array.from(tr.children).forEach(cell => {
          if (cell.tagName !== 'TD' && cell.tagName !== 'TH') return;
          const cidx = parseInt(cell.dataset.cidx);
          cell.dataset.caddr = _fColLetter(cidx > 0 ? cidx : pos) + (rIdx + 1);
          pos += (parseInt(cell.getAttribute('colspan')) || 1);
        });
      });
    });
  } catch(e) { console.error('assignCellAddrs:', e); }
}

// ── Build address→value map from current DOM ──────────────────────────────────
function _cellMap(table) {
  const m = {};
  Array.from(table.querySelectorAll('tr')).forEach((tr, ri) => {
    let ci = 1;
    Array.from(tr.children).forEach(cell => {
      if (cell.tagName !== 'TD' && cell.tagName !== 'TH') return;
      const addr  = cell.dataset.caddr || (_fColLetter(ci) + (ri + 1));
      const fxNum = cell.querySelector('.fx-num');
      const inp   = cell.querySelector('input');
      const raw   = fxNum ? fxNum.textContent : (inp ? inp.value : cell.textContent);
      const n     = parseFloat(raw.replace(/,/g, '').replace(/[^0-9.()\-]/g, '').replace(/\(([^)]+)\)/g, '-$1'));
      m[addr.toUpperCase()] = isNaN(n) ? 0 : n;
      ci += (parseInt(cell.getAttribute('colspan')) || 1);
    });
  });
  return m;
}

// ── Formula evaluator — uses _F library via new Function injection ─────────────
function evalFormula(formula, table) {
  if (!formula || !formula.startsWith('=')) return null;
  if (!table) return null;
  let expr = formula.slice(1).trim().toUpperCase();
  let cm;
  try { cm = _cellMap(table); } catch(e) { return null; }

  // Step 1: replace ranges with placeholders to avoid double-processing
  const rngMap = {};
  let rIdx = 0;
  expr = expr.replace(/([A-Z]{1,3}\d+):([A-Z]{1,3}\d+)/g, (_, s, e) => {
    const key = `__R${rIdx++}__`;
    rngMap[key] = `_F._range(cm,'${s}','${e}')`;
    return key;
  });

  // Step 2: replace standalone cell refs
  expr = expr.replace(/\b([A-Z]{1,3}\d+)\b/g, (_, a) => `_F._ref(cm,'${a}')`);

  // Step 3: restore ranges
  Object.entries(rngMap).forEach(([k, v]) => { expr = expr.split(k).join(v); });

  // Step 4: replace TRUE/FALSE constants
  expr = expr.replace(/\bTRUE\b/g, 'true').replace(/\bFALSE\b/g, 'false');

  // Step 5: route all FUNCNAME( → _F.FUNCNAME(
  expr = expr.replace(/\b([A-Z][A-Z0-9_]*)\s*\(/g, (_, fn) => `_F.${fn}(`);

  try {
    const result = new Function('_F', 'cm', `"use strict"; return (${expr});`)(_F, cm);
    if (typeof result === 'number'  && isFinite(result)) return result;
    if (typeof result === 'string')                      return result;
    if (typeof result === 'boolean')                     return result ? 1 : 0;
    return null;
  } catch { return null; }
}

// ── Stable formula key: tbodyId + caddr ───────────────────────────────────────
function _fkey(td) {
  const tbody = td.closest('tbody');
  const tbl   = td.closest('table');
  const tbid  = tbody?.id || tbl?.id || tbl?.className?.split(' ')[0] || 'tbl';
  return `${tbid}__${(td.dataset.caddr || 'X0').toUpperCase()}`;
}

// ── Apply formulas post-render ─────────────────────────────────────────────────
function applyFormulas() {
  try {
    document.querySelectorAll('td[data-fkey]').forEach(td => {
      delete td.dataset.fkey; td.classList.remove('formula-cell', 'formula-err');
    });
    Object.entries(FSTORE).forEach(([fkey, entry]) => {
      const td = _findCellByFkey(fkey); if (!td) return;
      td.dataset.fkey = fkey;
      const result = evalFormula(entry.formula, td.closest('table'));
      if (result === null) {
        td.classList.add('formula-err');
        td.title = '⚠ Error: ' + entry.formula;
        td.innerHTML += '<span class="fx-ind err" title="Formula error">!</span>';
      } else {
        td.classList.add('formula-cell');
        td.title = entry.formula + ' → ' + result;
        const origText = td.textContent.trim();
        const displayVal = /,\d{2},/.test(origText) ? fmtInr(result) :
                           (typeof result === 'string' ? result : fmt(result, 2));
        td.innerHTML = `<span class="fx-num">${displayVal}</span><span class="fx-ind" title="${escHtml(entry.formula)}">fx</span>`;
      }
    });
  } catch(e) { console.error('applyFormulas:', e); }
}

function _findCellByFkey(fkey) {
  const sep = fkey.lastIndexOf('__'); if (sep < 0) return null;
  const tbid = fkey.slice(0, sep), caddr = fkey.slice(sep + 2).toUpperCase();

  // Try the exact tbody/table by ID
  const container = document.getElementById(tbid);
  if (container) {
    const tbl = container.tagName === 'TABLE' ? container : (container.closest('table') || container);
    const cell = tbl.querySelector(`[data-caddr="${caddr}"].ed,[data-caddr="${caddr}"].edcasc`);
    if (cell) return cell;
  }

  // Fallback: search all editable cells with this caddr (handles class-named or ID-less tables)
  return document.querySelector(`td[data-caddr="${caddr}"].ed,td[data-caddr="${caddr}"].edcasc,th[data-caddr="${caddr}"].ed,th[data-caddr="${caddr}"].edcasc`) || null;
}

function _handleFormulaEdit(td, formulaStr) {
  assignCellAddrs();
  const fkey = _fkey(td), result = evalFormula(formulaStr, td.closest('table'));
  FSTORE[fkey] = { formula: formulaStr };
  td.dataset.fkey = fkey;
  return result !== null ? result : 0;
}

// ── Cell address hover badge ───────────────────────────────────────────────────
let _tipEl = null, _tipTarget = null, _tipTimer = null;

function _fpHoverInit() {
  _tipEl = document.getElementById('formula-tip');
  if (!_tipEl) return;

  document.addEventListener('mouseover', e => {
    if (_pickerActive || _fDragging) return;
    const cell = e.target.closest('td[data-caddr], th[data-caddr]');
    if (!cell) { _hideTip(); return; }
    clearTimeout(_tipTimer);
    _tipTarget = cell;
    document.getElementById('formula-tip-addr').textContent = cell.dataset.caddr || '';
    const fxBtn = document.getElementById('formula-tip-fx');
    if (fxBtn) fxBtn.style.display = (cell.classList.contains('ed') || cell.classList.contains('edcasc')) ? 'inline-flex' : 'none';
    const rect = cell.getBoundingClientRect();
    _tipEl.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
    _tipEl.style.left = Math.max(4, Math.min(rect.left + window.scrollX, window.innerWidth - 130)) + 'px';
    _tipEl.style.display = 'flex';
  }, { passive: true });

  document.addEventListener('mouseout', e => {
    const to = e.relatedTarget;
    if (to && (to.closest('#formula-tip') || to.closest('td[data-caddr]') || to.closest('th[data-caddr]'))) return;
    _hideTip();
  }, { passive: true });
}

function _hideTip() {
  clearTimeout(_tipTimer);
  _tipTimer = setTimeout(() => { if (_tipEl) _tipEl.style.display = 'none'; }, 200);
}

// ── Excel-like implicit cell picking (active when formula textarea is focused) ─
let _fImplicit  = false;   // formula textarea is focused
let _fDragStart = null;    // mousedown target cell
let _fDragEnd   = null;    // current drag-end cell
let _fDragging  = false;   // drag in progress

function _initImplicitPicker() {
  const ta = document.getElementById('fp-formula-input');
  if (!ta) return;

  ta.addEventListener('focus', () => {
    _fImplicit = true;
    document.body.classList.add('fp-picking');
  });
  ta.addEventListener('blur', () => {
    if (_fDragStart) return; // keep alive during drag
    _fImplicit = false;
    document.body.classList.remove('fp-picking');
  });

  // Intercept mousedown on cells while textarea is focused — prevent blur
  document.addEventListener('mousedown', e => {
    if (!_fImplicit) return;
    if (e.target.closest('#formula-panel')) return;   // clicks inside panel: normal
    const cell = e.target.closest('td[data-caddr], th[data-caddr]');
    if (!cell) return;
    e.preventDefault();   // ← keeps textarea focused
    _fDragStart = cell;
    _fDragEnd   = cell;
    _fDragging  = false;
    _highlightDrag(cell, cell);
  }, { capture: true });

  document.addEventListener('mousemove', e => {
    if (!_fDragStart) return;
    const cell = e.target.closest('td[data-caddr], th[data-caddr]');
    if (cell && cell !== _fDragEnd) {
      _fDragEnd  = cell;
      _fDragging = true;
      _highlightDrag(_fDragStart, cell);
    }
  });

  document.addEventListener('mouseup', e => {
    if (!_fDragStart) return;
    const endCell = e.target.closest('td[data-caddr], th[data-caddr]') || _fDragEnd;
    const ref = _buildRangeRef(_fDragStart, endCell);
    _clearDragHighlight();
    if (ref) _fpInsertAddr(ref);
    _fDragStart = null; _fDragEnd = null; _fDragging = false;
    ta.focus();
  });
}

// Build a range reference string from two cells
function _buildRangeRef(start, end) {
  if (!start?.dataset?.caddr) return '';
  if (!end?.dataset?.caddr || end === start) return start.dataset.caddr;
  const s = start.dataset.caddr, e = end.dataset.caddr;
  const sC = _fColNum(s.match(/[A-Z]+/)[0]), sR = parseInt(s.match(/\d+/)[0]);
  const eC = _fColNum(e.match(/[A-Z]+/)[0]), eR = parseInt(e.match(/\d+/)[0]);
  const minC = Math.min(sC,eC), maxC = Math.max(sC,eC), minR = Math.min(sR,eR), maxR = Math.max(sR,eR);
  if (minC === maxC && minR === maxR) return s;
  return `${_fColLetter(minC)}${minR}:${_fColLetter(maxC)}${maxR}`;
}

// Highlight all cells in the drag rectangle
function _highlightDrag(start, end) {
  _clearDragHighlight();
  const table = start?.closest('table');
  if (!table) return;
  const s = start.dataset.caddr, e = (end || start).dataset.caddr;
  const sC = _fColNum(s.match(/[A-Z]+/)[0]), sR = parseInt(s.match(/\d+/)[0]);
  const eC = _fColNum(e.match(/[A-Z]+/)[0]), eR = parseInt(e.match(/\d+/)[0]);
  const minC = Math.min(sC,eC), maxC = Math.max(sC,eC), minR = Math.min(sR,eR), maxR = Math.max(sR,eR);
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const cell = table.querySelector(`[data-caddr="${_fColLetter(c)}${r}"]`);
      if (cell) cell.classList.add('fp-drag-sel');
    }
  }
  // Show range in label
  const label = document.getElementById('fp-range-label');
  if (label) {
    const ref = _buildRangeRef(start, end);
    label.textContent = ref ? ref : '';
    label.style.display = ref ? 'inline' : 'none';
  }
}

function _clearDragHighlight() {
  document.querySelectorAll('.fp-drag-sel').forEach(c => c.classList.remove('fp-drag-sel'));
  const label = document.getElementById('fp-range-label');
  if (label) { label.textContent = ''; label.style.display = 'none'; }
}

// ── Formula panel ──────────────────────────────────────────────────────────────
function openFormulaPanel(td) {
  if (!td) td = _tipTarget;
  if (!td) return;
  if (!td.classList.contains('ed') && !td.classList.contains('edcasc')) {
    if (typeof kbToast === 'function') kbToast('⚠ This cell is not editable'); return;
  }
  _fpCell = td; assignCellAddrs(); _fpFkey = _fkey(td);
  const panel = document.getElementById('formula-panel'); if (!panel) return;
  const addr    = td.dataset.caddr || '?';
  const tblName = td.closest('.card')?.querySelector('h3,h4,.card-title,.tbl-title')?.textContent || '';
  document.getElementById('fp-cell-addr').textContent  = addr;
  document.getElementById('fp-table-name').textContent = tblName ? ' — ' + tblName.trim() : '';
  const existing = FSTORE[_fpFkey];
  document.getElementById('fp-formula-input').value = existing ? (existing.formula.startsWith('=') ? existing.formula.slice(1) : existing.formula) : '';
  document.getElementById('fp-ai-input').value = existing?.raw || '';
  const rect = td.getBoundingClientRect(), pw = 460;
  let left = Math.max(8, Math.min(rect.left + window.scrollX, window.innerWidth - pw - 12));
  let top  = rect.bottom + window.scrollY + 6;
  if (top + 340 > window.innerHeight + window.scrollY) top = rect.top + window.scrollY - 346;
  panel.style.left = left + 'px'; panel.style.top = top + 'px'; panel.style.display = 'flex';
  td.classList.add('fp-active-cell');
  fpSetMode('formula'); fpPreview();
  setTimeout(() => document.getElementById('fp-formula-input').focus(), 40);
}

function closeFormulaPanel() {
  const panel = document.getElementById('formula-panel');
  if (panel) panel.style.display = 'none';
  if (_fpCell) _fpCell.classList.remove('fp-active-cell');
  _stopPicker(); _clearDragHighlight();
  _fpCell = null; _fpFkey = null;
  _fImplicit = false; document.body.classList.remove('fp-picking');
  const res = document.getElementById('fp-ai-result'); if (res) res.style.display = 'none';
}

function fpSetMode(mode) {
  document.getElementById('fp-formula-area').style.display = mode === 'formula' ? 'block' : 'none';
  document.getElementById('fp-ai-area').style.display      = mode === 'ai'      ? 'block' : 'none';
  document.getElementById('fp-mode-formula').classList.toggle('active', mode === 'formula');
  document.getElementById('fp-mode-ai').classList.toggle('active',      mode === 'ai');
  // Hide footer Apply button in AI mode — AI tab has its own ✓ Apply on each result
  const applyBtn = document.querySelector('.fp-btn.apply');
  if (applyBtn) applyBtn.style.display = mode === 'ai' ? 'none' : '';
}

function fpTogglePicker() { _pickerActive ? _stopPicker() : _startPicker(); }

function fpApply() {
  if (!_fpCell || !_fpFkey) return;
  const raw = document.getElementById('fp-formula-input').value.trim();
  if (!raw) { fpClear(); return; }
  const formula  = raw.startsWith('=') ? raw : '=' + raw;
  const savedCell = _fpCell, savedFkey = _fpFkey;

  // Evaluate (safe — won't throw)
  let result = null;
  try { result = evalFormula(formula, savedCell.closest('table')); } catch(e) { console.warn('fpApply eval:', e); }

  // Persist formula to store
  FSTORE[savedFkey] = { formula, raw: document.getElementById('fp-ai-input').value };
  savedCell.dataset.fkey = savedFkey;

  // Push numeric result into data model so totals update
  if (result !== null) {
    try {
      const eid = +savedCell.dataset.eid;
      if (eid && EH[eid] && !EH[eid].isStr) EH[eid].setVal(typeof result === 'number' ? result : parseFloat(result) || 0);
    } catch(e) { console.warn('fpApply setVal:', e); }
  }

  closeFormulaPanel();
  try { recompute(); renderAll(); } catch(e) { console.warn('fpApply renderAll:', e); }

  // Direct DOM update as safety net — ensures cell turns blue even if applyFormulas missed it
  setTimeout(() => {
    const td = _findCellByFkey(savedFkey);
    if (!td) return;
    let r = null;
    try { r = evalFormula(formula, td.closest('table')); } catch(e) {}
    const val = r !== null ? r : (result !== null ? result : 0);
    td.dataset.fkey = savedFkey;
    td.classList.add('formula-cell');
    td.title = formula + ' → ' + val;
    const display = typeof val === 'string' ? escHtml(val) : fmt(val, 2);
    td.innerHTML = `<span class="fx-num">${display}</span><span class="fx-ind" title="${escHtml(formula)}">fx</span>`;
  }, 0);
}

function fpClear() {
  if (!_fpFkey) { closeFormulaPanel(); return; }
  delete FSTORE[_fpFkey];
  if (_fpCell) { delete _fpCell.dataset.fkey; _fpCell.classList.remove('formula-cell','formula-err'); }
  closeFormulaPanel(); renderAll();
}

function fpPreview() {
  const el = document.getElementById('fp-preview'); if (!el || !_fpCell) return;
  const raw = document.getElementById('fp-formula-input').value.trim();
  if (!raw) { el.textContent = ''; el.className = 'fp-preview'; return; }
  const formula = raw.startsWith('=') ? raw : '=' + raw;
  const result  = evalFormula(formula, _fpCell.closest('table'));
  if (result === null) { el.textContent = '⚠ Invalid formula'; el.className = 'fp-preview err'; }
  else { el.textContent = 'Preview: ' + result; el.className = 'fp-preview ok'; }
}

// Insert addr at cursor in the formula textarea
function _fpInsertAddr(addr) {
  const ta = document.getElementById('fp-formula-input');
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  ta.value    = ta.value.slice(0, start) + addr + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + addr.length;
  ta.focus(); fpPreview();
}

// ── Manual cell picker (triggered by picker button) ───────────────────────────
function _startPicker() {
  _pickerActive = true;
  const btn = document.getElementById('fp-picker-btn'); if (btn) btn.classList.add('active');
  const hint = document.getElementById('fp-picker-hint'); if (hint) hint.style.display = '';
  document.getElementById('fp-picker-icon').textContent = '✕';
  document.body.classList.add('formula-picker-mode');
  document.querySelectorAll('td[data-caddr], th[data-caddr]').forEach(td => td.classList.add('picker-avail'));
}

function _stopPicker() {
  _pickerActive = false;
  const btn = document.getElementById('fp-picker-btn');
  if (btn) { btn.classList.remove('active'); const ic = document.getElementById('fp-picker-icon'); if (ic) ic.textContent = '⊕'; }
  const hint = document.getElementById('fp-picker-hint'); if (hint) hint.style.display = 'none';
  document.body.classList.remove('formula-picker-mode');
  document.querySelectorAll('.picker-avail,.picker-hover,.picker-sel').forEach(td => td.classList.remove('picker-avail','picker-hover','picker-sel'));
}

// Manual picker click
document.addEventListener('click', e => {
  if (!_pickerActive) return;
  if (e.target.closest('#formula-panel')) return;
  const cell = e.target.closest('td[data-caddr], th[data-caddr]');
  if (!cell || cell === _fpCell) return;
  e.preventDefault(); e.stopPropagation();
  cell.classList.add('picker-sel'); setTimeout(() => cell.classList.remove('picker-sel'), 500);
  _fpInsertAddr(cell.dataset.caddr);
  if (typeof kbToast === 'function') kbToast('Cell ' + cell.dataset.caddr + ' inserted');
}, { capture: true });

document.addEventListener('mouseover', e => {
  if (!_pickerActive) return;
  document.querySelectorAll('.picker-hover').forEach(t => t.classList.remove('picker-hover'));
  const cell = e.target.closest('td[data-caddr], th[data-caddr]');
  if (cell && cell !== _fpCell) cell.classList.add('picker-hover');
}, { passive: true });

// Escape closes panel or stops picker
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const panel = document.getElementById('formula-panel');
  if (panel && panel.style.display !== 'none') { closeFormulaPanel(); e.stopPropagation(); }
}, { capture: true });

// Live preview while typing
document.addEventListener('input', e => { if (e.target.id === 'fp-formula-input') fpPreview(); });

// ── Shared API key (localStorage) ─────────────────────────────────────────────
function getApiKey() { return localStorage.getItem('anthropic_api_key') || window._LOCAL_API_KEY || ''; }

function apiKeyLiveSet(val) {
  const key = val.trim();
  localStorage.setItem('anthropic_api_key', key);
  const topInput = document.getElementById('api-key-input'), panelInput = document.getElementById('fp-key-inline');
  if (topInput   && topInput   !== document.activeElement) topInput.value   = key;
  if (panelInput && panelInput !== document.activeElement) panelInput.value = key;
  const dot = document.getElementById('api-key-dot'); if (dot) dot.className = 'api-dot ' + (key ? 'set' : 'unset');
  window.ssApiKey = key;
}

function toggleApiKeyInput() {
  const drop = document.getElementById('api-key-drop'); if (!drop) return;
  const open = drop.style.display !== 'none';
  drop.style.display = open ? 'none' : 'flex';
  if (!open) { const inp = document.getElementById('api-key-input'); if (inp) { inp.value = getApiKey(); inp.focus(); inp.select(); } }
}

// Stores last AI-generated formula — avoids HTML double-quote injection in onclick attributes
let _fpAIResult = '';

// ── AI formula generation ──────────────────────────────────────────────────────
function fpAskAI() {
  const desc = document.getElementById('fp-ai-input').value.trim();
  if (!desc) { if (typeof kbToast === 'function') kbToast('⚠ Describe what you want'); return; }
  const apiKey = getApiKey();
  const keyRow = document.getElementById('fp-key-row');
  if (!apiKey) {
    if (keyRow) { keyRow.style.display = 'flex'; document.getElementById('fp-key-inline')?.focus(); }
    if (typeof kbToast === 'function') kbToast('⚠ Enter your Anthropic API key above'); return;
  }
  if (keyRow) keyRow.style.display = 'none';
  const resEl = document.getElementById('fp-ai-result');
  resEl.style.display = 'block'; resEl.innerHTML = '<em style="color:#888">Generating…</em>';
  const addr = _fpCell?.dataset.caddr || '?', table = _fpCell?.closest('table');
  const cm   = table ? _cellMap(table) : {};
  const ctx  = Object.entries(cm).slice(0, 40).map(([k,v]) => `${k}=${v}`).join(', ');
  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 100,
      system: `Formula assistant for a financial spreadsheet. Cell being edited: ${addr}. Nearby cells and values: ${ctx}. Reply with ONLY the formula starting with =. No prose. Supported: all standard Excel functions including NPV IRR XIRR PMT PV FV RATE PMT SUM AVERAGE IF IFERROR AND OR SUMIF COUNTIF VLOOKUP INDEX MATCH STDEV and any arithmetic.`,
      messages: [{ role: 'user', content: desc }]
    })
  })
  .then(r => r.json())
  .then(data => {
    const formula = data.content?.[0]?.text?.trim() || '';
    if (!formula) { resEl.innerHTML = '<span style="color:#c0392b">⚠ No formula returned</span>'; return; }
    _fpAIResult = formula;
    resEl.innerHTML = `<div class="fp-ai-out"><code>${escHtml(formula)}</code><button class="fp-ai-use-btn" onclick="fpUseAIFormula(_fpAIResult)">✓ Apply</button></div>`;
  })
  .catch(err => { resEl.innerHTML = `<span style="color:#c0392b">⚠ ${escHtml(err.message)}</span>`; });
}

function fpUseAIFormula(formula) {
  const inp = document.getElementById('fp-formula-input');
  inp.value = formula.startsWith('=') ? formula.slice(1) : formula;
  fpSetMode('formula');
  fpApply();
}

// ── Init ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _fpHoverInit();
  _initImplicitPicker();

  // Hydrate API key UI from localStorage
  const saved = getApiKey();
  if (saved) {
    window.ssApiKey = saved;
    const topInput = document.getElementById('api-key-input'); if (topInput) topInput.value = saved;
    const dot = document.getElementById('api-key-dot'); if (dot) dot.className = 'api-dot set';
  }

  // Close API key dropdown on outside click
  document.addEventListener('mousedown', e => {
    const wrap = document.getElementById('api-key-wrap'), drop = document.getElementById('api-key-drop');
    if (wrap && drop && drop.style.display !== 'none' && !wrap.contains(e.target)) drop.style.display = 'none';
  });
});
