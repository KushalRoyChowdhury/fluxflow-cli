#!/usr/bin/env node
import{a as F}from"./chunks/chunk-4TZKD2XR.js";import{spawn as ie}from"child_process";import{fileURLToPath as _}from"url";import le from"os";import b from"dotenv";b.config({quiet:!0});b.config({path:"./fluxflow.env",override:!0,quiet:!0});b.config({path:"./.fluxflow.env",override:!0,quiet:!0});b.config({path:`${F}/.fluxflow.env`,override:!0,quiet:!0});b.config({path:`${F}/fluxflow.env`,override:!0,quiet:!0});var ce=le.totalmem(),D=ce/(1024*1024),ue=.5,pe=Math.floor(D*ue),U=process.argv.slice(2),L=U.indexOf("--allocation"),s=L!==-1?parseInt(U[L+1],10):NaN,me=process.env.EXPERIMENTAL_MEMORY_MANAGER==="true"||process.env.EXPERIMENTAL_MEMORY_MANAGER==="1"||process.env.EXPERIMENTAL_MEMORY_MANAGER===!0||process.env.EXPERIMENTAL_MEMORY_MANAGER===1||!1,de=!isNaN(s)||me||!1;!isNaN(s)&&s<64&&(console.error(`
[ERROR] Allocation value '${s} MB' is too low. Minimum: 64 MB, Recommended: 4096 MB.
`),process.exit(1));var y=Math.floor(D*.75),ge=!isNaN(s)&&s>0?Math.min(s,y):Math.max(1536,Math.min(32768,pe)),fe=_(import.meta.url).endsWith(".js");if(fe&&!process.execArgv.some(o=>o.includes("max-old-space-size"))&&de)Number.isNaN(s)||(console.log(`
[MEMORY] Starting with: '${s>y?y:s} MB' Allocation${s>y?" (Max allowed: '"+y+" MB')":""}. Please Wait...`),await new Promise(u=>setTimeout(u,5e3))),ie(process.execPath,[`--max-old-space-size=${ge}`,"--expose-gc","--max-semi-space-size=1",_(import.meta.url),...process.argv.slice(2)],{stdio:"inherit"}).on("exit",u=>process.exit(u||0));else{let o=process.argv.slice(2),u=o.includes("--help")&&o[o.indexOf("--help")+1]==="commands",T=o.includes("--help")&&!u,P=o.includes("--version")||o.includes("-v"),R=o[0]==="--update",I=o[0]==="--export";if(o[0]==="--usage"||o.includes("--usage")||o[0]==="--budget"||o.includes("--budget")){let{openUsageDashboard:e}=await import("./chunks/usageServer-2ICYG54E.js"),{url:r}=await e();console.log(`
\u2726 FluxFlow Token Usage & Analytics Dashboard
\u2800\u2800\u2514\u2500 Serving at: ${r}
\u2800\u2800\u2514\u2500 Opened in default browser. Press Ctrl+C to stop.
`),await new Promise(()=>{})}if(P||T||u||R||I){let e=await import("fs"),r=await import("path"),{fileURLToPath:n}=await import("url"),p=r.join(r.dirname(n(import.meta.url)),"../package.json"),m=JSON.parse(e.readFileSync(p,"utf8")).version;if(I){let w=(o[1]||"").toLowerCase();if(w==="error"||w==="logs")try{let{exportErrorLogs:i}=await import("./chunks/export-PSA6YZMJ.js"),l=await i();console.log(`[EXPORT LOGS] Exported ${l.entryCount} error log entries (FluxFlow: ${l.fluxflowCount}, Memory: ${l.memoryCount}) to "${l.exportFile}"`),process.exit(0)}catch(i){console.error(`[EXPORT ERROR] Failed to export error logs: ${i.message}`),process.exit(1)}else console.error(`[EXPORT ERROR] Invalid export target "${o[1]||""}". --export only supports 'error'.
Usage: fluxflow --export error`),process.exit(1)}if(P&&(console.log(`v${m}`),process.exit(0)),T&&(console.log(`FluxFlow CLI Arguments:
  --mode <flux|flow>                   Set startup mode (flux: Agent / flow: Chat)
  --model <model_name>                 Set startup AI model
  --key <key@provider>                 Set API key and provider
  --provider <google|deepseek|openrouter|nvidia|mistral|ollama|crofai> Override default provider
  --thinking <Fast|Low|Medium|High|xHigh> Set startup thinking level
  --memory <on|off>                    Toggle memory system
  --resume <session_id>                Resume a previous session
  --allocation <mb>                    Override Node.js max-old-space-size in MB (default: auto)
  --package <npm|pnpm|yarn|bun>        Set package manager for updates
  --auto-del <1d|7d|30d>               Set history auto-deletion timeframe
  --auto-exec <on|off>                 Toggle permission for autonomous command execution
  --yolo <on|off>                      Same as --auto-exec
  --external-access <on|off>           Toggle permission for file reads outside CWD
  -v, --version                        Show installed version
  --help                               Show this help menu
  --help commands                      Show available /commands
  --playground                         Launch in Playground mode (fixed session, CWD: DATA_DIR/playground)
  --cwd <path>                         Set working directory to path
  --path <path>                        Same as --cwd, set working directory
  --usage                              Open token usage analytics dashboard in browser
  --export error                       Export system error logs to fluxflow-error-<timestamp>.txt
  --update check                       Check for new updates
  --update check latest                Show the latest version available on npm
  --update [latest]                    Update the app to the latest version (latest is default)`),process.exit(0)),u&&(console.log(`FluxFlow Chat /Commands:
  /quit                                    Exit and shutdown Flux
  /help                                    Show help menu
  /clear                                   Clear terminal screen
  /resume                                  Load previous session
  /compress                                Summarize and compress chat history
  /truncate                                Truncate tool results in chat history
  /revert                                  Revert codebase back to a checkpoint
  /save                                    Force save current chat
  /export [chat|logs]                      Export chat session or system error logs
  /chats                                   List all chat sessions
  /btw <question>                          Send raw inquiry to the agent mid-turn
  /image setup key <default|custom>        Configure image API key strategy
  /budget                                  Set or View budget limits
  /mode <flux|flow>                        Toggle Flux/Flow modes
  /thinking <Fast|Low|Medium|High|xHigh>   Set AI reasoning depth
  /model <model_name>                      Switch Model for Agent
  /wildcard-tooling                        Use if the model lacks Tooling Capability
  /provider                                Select AI Provider
  /settings                                Configure system preferences
  /theme                                   Customize UI color theme
  /key                                     Manage API keys
  /profile                                 Edit developer persona
  /memory                                  Manage agent memory
  /stats                                   Show session usage
  /usage                                   Open graphical token analytics dashboard in browser
  /reset                                   Wipe all project data
  /about                                   Project info & credits
  /changelog                               View latest updates
  /docs                                    View documentation
  /fluxflow init                           Create FluxFlow.md template
  /update check                            Check for new version
  /update latest                           Install latest release`),process.exit(0)),R){let w=o[1]||"latest";if(w==="check"){let i=o[2]==="latest";try{let f=(await(await fetch("https://registry.npmjs.org/fluxflow-cli",{cache:"no-store"})).json())["dist-tags"]?.latest;f||(console.error("Error: Could not retrieve latest version."),process.exit(1)),console.log(i?`Latest version: v${f}`:f!==m?`A new version of FluxFlow is available: v${f} (current: v${m}). Run "fluxflow --update latest" to upgrade.`:`FluxFlow is up to date (v${m}).`)}catch(l){console.error("Error checking for updates:",l.message),process.exit(1)}process.exit(0)}else if(w==="latest"){console.log("Checking latest version and settings...");try{let a=(await(await fetch("https://registry.npmjs.org/fluxflow-cli",{cache:"no-store"})).json())["dist-tags"]?.latest;a||(console.error("Error: Could not retrieve latest version."),process.exit(1)),a===m&&(console.log(`FluxFlow is already up to date (v${m}).`),process.exit(0));let f=async()=>{let t=(await import("react")).default,{useState:O}=t,{render:z,Box:g,Text:h}=await import("ink"),J=(await import("ink-select-input")).default,K=(await import("ink-text-input")).default;return new Promise(Q=>{let Z=[{label:"NPM",value:"npm"},{label:"PNPM",value:"pnpm"},{label:"Yarn",value:"yarn"},{label:"Bun",value:"bun"},{label:"Custom Command",value:"custom"}],ee=({label:v,isSelected:E})=>t.createElement(g,{width:"100%"},t.createElement(h,{bold:E},"\u2514\u2500 ",E?"\x1B[32m\u25CF\x1B[0m":"\u25CB"," ",v)),A,oe=()=>{let[v,E]=O("select"),[se,re]=O(""),ae=S=>{S.value==="custom"?E("custom"):B({manager:S.value})},ne=S=>{B({manager:"custom",customCommand:S})};return v==="custom"?t.createElement(g,{flexDirection:"column",marginY:1},t.createElement(g,{marginBottom:1},t.createElement(h,{color:"magenta",bold:!0},"\u{1F527} Enter custom update command:")),t.createElement(g,{flexDirection:"row"},t.createElement(h,{color:"cyan",bold:!0},"   \u276F "),t.createElement(K,{value:se,onChange:re,onSubmit:ne})),t.createElement(g,{marginTop:1},t.createElement(h,{color:"gray",dimColor:!0,italic:!0},"   (Press Enter to confirm)"))):t.createElement(g,{flexDirection:"column",marginY:1},t.createElement(g,{marginBottom:1},t.createElement(h,{color:"magenta",bold:!0},"\u{1F4E6} Select a package manager for the update:")),t.createElement(J,{items:Z,onSelect:ae,itemComponent:ee,indicatorComponent:()=>null}))},B=v=>{A&&A(),Q(v)},{unmount:te}=z(t.createElement(oe,null));A=te})},c,N="",M;try{let{loadSettings:t}=await import("./chunks/settings-QKREUSRE.js");M=await t(),c=M?.systemSettings?.updateManager||M?.updateManager}catch{}if(!c){let t=await f();c=t.manager,N=t.customCommand}let d="";c==="pnpm"?d=`pnpm add -g fluxflow-cli@${a}`:c==="bun"?d=`bun add -g fluxflow-cli@${a}`:c==="yarn"?d=`yarn global add fluxflow-cli@${a}`:c==="custom"?d=N||M?.customUpdateCommand||`npm install -g fluxflow-cli@${a}`:d=`npm install -g fluxflow-cli@${a}`,console.log(`Updating FluxFlow to v${a} using ${c}...`),console.log(`Running: ${d}`);let{execSync:V}=await import("child_process");V(d,{stdio:"inherit"}),console.log(`\x1B[32m\u2705 Update successful! FluxFlow updated to v${a}.\x1B[0m`)}catch(i){console.error("\x1B[31m\u274C Update failed:\x1B[0m",i.message),process.exit(1)}process.exit(0)}else console.error("Unknown update command. Available options: --update, --update check, --update check latest, --update latest"),process.exit(1)}}let{default:j}=await import("react"),{render:Y}=await import("ink"),{default:G}=await import("./chunks/app-BSYE4L5G.js");process.env.NODE_NO_WARNINGS="1";let H=["cuimp","Found existing binary","Binary verified","curl.exe not found","Falling back to .bat file","DeprecationWarning"],W=console.log,q=console.warn,X=console.error,C=e=>{let r=e.map(String).join(" ");return H.some(n=>r.includes(n))};console.log=(...e)=>!C(e)&&W(...e),console.warn=(...e)=>!C(e)&&q(...e),console.error=(...e)=>!C(e)&&X(...e);let k=o.findIndex(e=>e==="--cwd"||e==="--path");if(k!==-1&&k+1<o.length){let e=o[k+1],r=await import("path"),n=await import("fs-extra"),p=r.default.resolve(e);try{n.default.existsSync(p)&&n.default.statSync(p).isDirectory()?process.chdir(p):(console.error(`[ERROR] Directory not found: "${e}"`),process.exit(0))}catch(x){console.error(`[ERROR] Failed to change directory to "${e}": ${x.message}`),process.exit(0)}}process.stdout.write("\x1B[2J\x1B[3J\x1B[H"),process.stdout.isTTY&&(process.stdout.write("\x1B]0;FluxFlow\x07"),process.stdout.write("\x1B]633;P;TerminalTitle=FluxFlow\x07"),process.stdout.write("\x1B[?2004h"));let $=()=>{process.stdout.isTTY&&process.stdout.write("\x1B[?2004l")};if(process.on("exit",$),["SIGINT","SIGTERM","SIGHUP"].forEach(e=>{process.once(e,()=>{$(),process.exit(0)})}),o.includes("--playground")){let e=process.cwd();process.argv.push("--original-cwd",e);let{DATA_DIR:r}=await import("./chunks/paths-CHZDSDRF.js"),n=await import("path"),p=await import("fs-extra"),x=n.default.join(r,"playground");try{p.default.ensureDirSync(x),process.chdir(x)}catch{}}Y(j.createElement(G,{args:process.argv.slice(2)}),{exitOnCtrlC:!1})}
