import{d as S}from"./chunk-I27MASHH.js";import O from"fs-extra";import T from"path";var C=a=>{if(!a)return[];let u=[],h=/\[tool:(.*?)\((.*?)\)\]/g,r=0,l;for(;(l=h.exec(a))!==null;){if(l.index>r){let t=a.slice(r,l.index);t.trim()&&u.push({type:"output",content:t})}u.push({type:"tool",toolName:l[1],args:l[2]}),r=h.lastIndex}if(r<a.length){let t=a.slice(r);t.trim()&&u.push({type:"output",content:t})}return u},b=async(a,u,h=process.cwd())=>{let r=`export-fluxflow-${a}.txt`,l=T.join(h,r),t=[],c=!1;for(let g=0;g<u.length;g++){let i=u[g];if(i&&!(i.role==="system"||i.isMeta||i.isLogo||String(i.id).startsWith("welcome"))){if(i.role==="user"){let e=i.text||"";e=e.replace(/\s*\[Prompted on:.*?\]/g,"").trim(),t.length>0&&t.push(""),t.push("[USER]"),t.push(e),c=!1}else if(i.role==="think"){c||(t.push(""),t.push("[AGENT]"),c=!0);let e=(i.text||"").replace(/\[\[\s*turn\s*:\s*(continue|finish)\s*\]\]/gi,"").replace(/\[\[END\]\]/gi,"").replace(/\[\[TOOL RESULTS\]\]/gi,"").replace(/\[TOOL RESULTS\]/gi,"").replace(/\[TOOL RESULT\]/gi,"").trim();e&&(t.push("[thoughts]"),t.push(e))}else if(i.role==="agent"){c||(t.push(""),t.push("[AGENT]"),c=!0);let e=C(i.text||"");for(let p of e)if(p.type==="output"){let m=p.content.replace(/\[\[\s*turn\s*:\s*(continue|finish)\s*\]\]/gi,"").replace(/\[\[END\]\]/gi,"").replace(/\[\[TOOL RESULTS\]\]/gi,"").replace(/\[TOOL RESULTS\]/gi,"").replace(/\[TOOL RESULT\]/gi,"").trim();m&&(t.push("[output]"),t.push(m))}else p.type==="tool"&&(t.push("[tool]"),t.push(`${p.toolName} ${p.args}`))}}}let R=t.join(`
`);return await O.writeFile(l,R,"utf8"),{exportFile:r,exportPath:l,totalLines:t.length}},j=(a,u="FluxFlow",h=null)=>{if(!a||!a.trim())return[];let r=a.split(`
`),l=[],t=[],c=/^\s*(?:CRITICAL\s+ERROR|ERROR|DEBUG|SEARCH|PUPPETEER|WARN|WARNING|INFO)\b/i,R=/^\s*-{3,}\s*$/,g=!1;for(let e of r)if(c.test(e)){g=!0;break}if(!g){let e=a.trim();if(!e)return[];let p=h?new Date(h).toLocaleString():"Unknown Time",m=/\bjanitor\b/i.test(e)?"Memory":u;return[{timestamp:p,level:"ERROR",source:m,message:e}]}for(let e of r)R.test(e)?t.length>0&&(l.push(t.join(`
`).trim()),t=[]):c.test(e)?(t.length>0&&(l.push(t.join(`
`).trim()),t=[]),t.push(e)):(t.length>0||e.trim())&&t.push(e);t.length>0&&l.push(t.join(`
`).trim());let i=[];for(let e of l){if(!e)continue;let p=e.split(`
`).map(o=>o.trimEnd()),m=p[0]||"";if(!/\bERROR\b/i.test(e))continue;let d=m.match(/\[(.*?)\]/),s=d?d[1]:null,f="ERROR";/CRITICAL\s+ERROR/i.test(m)&&(f="CRITICAL ERROR");let n="";if(d){let o=m.indexOf("]:");o!==-1?n=m.substring(o+2).trim():n=m.replace(c,"").replace(/\[.*?\]/,"").replace(/^:\s*/,"").trim()}else n=m.replace(c,"").replace(/^:\s*/,"").trim();if(p.length>1){let o=p.slice(1).join(`
`).trim();o&&(n=n?`${n}
${o}`:o)}if(n){let o=/\bjanitor\b/i.test(e)?"Memory":u;i.push({timestamp:s||(h?new Date(h).toLocaleString():"Unknown Time"),level:f,source:o,message:n})}}return i},U=async(a=process.cwd())=>{let u=`fluxflow-error-${Date.now()}.txt`,h=T.join(a,u),r=async s=>{if(!await O.pathExists(s))return[];let f=await O.readdir(s),n=[];for(let o of f){let E=T.join(s,o),x=await O.stat(E);if(x.isDirectory()){let L=await r(E);n=n.concat(L)}else(o.endsWith(".log")||o.endsWith(".txt"))&&n.push({path:E,mtime:x.mtimeMs})}return n},l=await r(S),t=[];for(let s of l)try{let f=await O.readFile(s.path,"utf8");if(f.trim()){let n=s.path.replace(/\\/g,"/").toLowerCase(),o="FluxFlow";n.includes("/janitor")||n.includes("janitor")?o="Memory":!n.includes("/agent")&&!n.includes("agent")&&(o="Other");let E=j(f,o,s.mtime);t=t.concat(E)}}catch{}let c=[],R=new Set;for(let s of t){let f=`${s.source}::${s.timestamp}::${s.message.trim()}`;R.has(f)||(R.add(f),c.push(s))}let g=c.filter(s=>s.source==="FluxFlow"),i=c.filter(s=>s.source==="Memory"),e=c.filter(s=>s.source!=="FluxFlow"&&s.source!=="Memory"),p=(s,f,n)=>{let o=["================================================================================",`${s} (${f.length})`,"================================================================================"].join(`
`);if(f.length===0)return`${o}
No ${n} error entries found.`;let E=f.map((x,L)=>{let $=`[${n} #${L+1}] ${x.timestamp} (${x.level})`,F=x.message.split(`
`).map(y=>`    ${y}`).join(`
`);return`${$}
${F}`});return`${o}

`+E.join(`

--------------------------------------------------------------------------------

`)},m=["================================================================================","FLUXFLOW ERROR LOGS EXPORT",`Exported At : ${new Date().toLocaleString()}`,`Total Errors: ${c.length} (FluxFlow: ${g.length} | Memory: ${i.length}${e.length>0?` | Other: ${e.length}`:""})`,"================================================================================",""].join(`
`),w=[p("SECTION 1: FLUXFLOW ERRORS",g,"FluxFlow"),p("SECTION 2: MEMORY ERRORS",i,"Memory")];e.length>0&&w.push(p("SECTION 3: OTHER SYSTEM ERRORS",e,"Other"));let d=m+w.join(`


`)+`
`;return await O.writeFile(h,d,"utf8"),{exportFile:u,exportPath:h,entryCount:c.length,fluxflowCount:g.length,memoryCount:i.length}},A=async(a,{chatId:u,messages:h})=>{let r=(a[1]||"chat").toLowerCase();return r==="chat"?{success:!0,type:"chat",message:`\u2726 Chat Exported
\u2800\u2800\u2514\u2500 ${(await b(u,h)).exportFile}
\u2800`}:r==="logs"?{success:!0,type:"logs",message:`\u2726 Error Logs Exported
\u2800\u2800\u2514\u2500 ${(await U()).exportFile}
\u2800`}:{success:!1,message:`[EXPORT USAGE] Unknown subcommand "${r}". Options:
 \u2022 /export chat current
 \u2022 /export logs error`}};export{C as a,b,j as c,U as d,A as e};
