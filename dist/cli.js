#!/usr/bin/env node
import{a as r}from"./chunks/chunk-4TZKD2XR.js";import{spawn as ce}from"child_process";import{fileURLToPath as D}from"url";import ue from"os";import B from"path";import S from"fs";import s from"dotenv";try{let e=B.join(r,"AGENTS.md"),l=B.join(r,"FLUXFLOW.md");!S.existsSync(e)&&!S.existsSync(l)&&(S.existsSync(r)||S.mkdirSync(r,{recursive:!0}),S.writeFileSync(e,"","utf8"))}catch{}s.config({path:"./.env",override:!0,quiet:!0});s.config({path:`${r}/.env`,override:!0,quiet:!0});s.config({path:"./agents.env",override:!0,quiet:!0});s.config({path:"./.agents.env",override:!0,quiet:!0});s.config({path:`${r}/agents.env`,override:!0,quiet:!0});s.config({path:`${r}/.agents.env`,override:!0,quiet:!0});s.config({path:"./fluxflow.env",override:!0,quiet:!0});s.config({path:"./.fluxflow.env",override:!0,quiet:!0});s.config({path:`${r}/fluxflow.env`,override:!0,quiet:!0});s.config({path:`${r}/.fluxflow.env`,override:!0,quiet:!0});s.config({path:`${r}/.env.agents`,override:!0,quiet:!0});s.config({path:`${r}/.env.fluxflow`,override:!0,quiet:!0});s.config({path:"./.env.agents",override:!0,quiet:!0});s.config({path:"./.env.fluxflow",override:!0,quiet:!0});process.env.NO_INS=!1;var pe=ue.totalmem(),q=pe/(1024*1024),de=.5,me=Math.floor(q*de),j=process.argv.slice(2),U=j.indexOf("--allocation"),n=U!==-1?parseInt(j[U+1],10):NaN,ge=process.env.EXPERIMENTAL_MEMORY_MANAGER==="true"||process.env.EXPERIMENTAL_MEMORY_MANAGER==="1"||process.env.EXPERIMENTAL_MEMORY_MANAGER===!0||process.env.EXPERIMENTAL_MEMORY_MANAGER===1||!1,fe=!isNaN(n)||ge||!1;!isNaN(n)&&n<64&&(console.error(`
[ERROR] Allocation value '${n} MB' is too low. Minimum: 64 MB, Recommended: 4096 MB.
`),process.exit(1));var M=Math.floor(q*.75),xe=!isNaN(n)&&n>0?Math.min(n,M):Math.max(1536,Math.min(32768,me)),he=D(import.meta.url).endsWith(".js");if(he&&!process.execArgv.some(e=>e.includes("max-old-space-size"))&&fe)Number.isNaN(n)||(console.log(`
[MEMORY] Starting with: '${n>M?M:n} MB' Allocation${n>M?" (Max allowed: '"+M+" MB')":""}. Please Wait...`),await new Promise(l=>setTimeout(l,5e3))),ce(process.execPath,[`--max-old-space-size=${xe}`,"--expose-gc","--max-semi-space-size=1",D(import.meta.url),...process.argv.slice(2)],{stdio:"inherit"}).on("exit",l=>process.exit(l||0));else{let e=process.argv.slice(2),l=e.includes("--help")&&e[e.indexOf("--help")+1]==="commands",P=e.includes("--help")&&!l,$=e.includes("--version")||e.includes("-v"),R=e[0]==="--update",I=e[0]==="--export";if(e[0]==="--usage"||e.includes("--usage")||e[0]==="--budget"||e.includes("--budget")){let{openUsageDashboard:o}=await import("./chunks/usageServer-W24RPVXC.js"),{url:a}=await o();console.log(`
\u2726 FluxFlow Token Usage & Analytics Dashboard
\u2800\u2800\u2514\u2500 Serving at: ${a}
\u2800\u2800\u2514\u2500 Opened in default browser. Press Ctrl+C to stop.
`),await new Promise(()=>{})}if($||P||l||R||I){let o=await import("fs"),a=await import("path"),{fileURLToPath:c}=await import("url"),m=a.join(a.dirname(c(import.meta.url)),"../package.json"),g=JSON.parse(o.readFileSync(m,"utf8")).version;if(I){let v=(e[1]||"").toLowerCase();if(v==="error"||v==="logs")try{let{exportErrorLogs:u}=await import("./chunks/export-PSA6YZMJ.js"),p=await u();console.log(`[EXPORT LOGS] Exported ${p.entryCount} error log entries (FluxFlow: ${p.fluxflowCount}, Memory: ${p.memoryCount}) to "${p.exportFile}"`),process.exit(0)}catch(u){console.error(`[EXPORT ERROR] Failed to export error logs: ${u.message}`),process.exit(1)}else console.error(`[EXPORT ERROR] Invalid export target "${e[1]||""}". --export only supports 'error'.
Usage: fluxflow --export error`),process.exit(1)}if($&&(console.log(`v${g}`),process.exit(0)),P&&(console.log(`FluxFlow CLI Arguments:
  --mode <flux|flow>                       Set startup mode (flux: Agent / flow: Chat)
  --model <model_name>                     Set startup AI model
  --key <key@provider>                     Set API key and provider
  --provider                               Override default provider
  --thinking <Fast|Low|Medium|High|xHigh>  Set startup thinking level
  --memory <on|off>                        Toggle memory system
  --resume <session_id>                    Resume a previous session
  --allocation <mb>                        Override Node.js max-old-space-size in MB (default: auto)
  --package <npm|pnpm|yarn|bun>            Set package manager for updates
  --auto-del <1d|7d|30d>                   Set history auto-deletion timeframe
  --auto-exec <on|off>                     Toggle permission for autonomous command execution
  --yolo <on|off>                          Same as --auto-exec
  --external-access <on|off>               Toggle permission for file reads outside CWD
  -v, --version                            Show installed version
  --help                                   Show this help menu
  --help commands                          Show available /commands
  --playground                             Launch in Playground mode (fixed session, CWD: DATA_DIR/playground)
  --cwd <path>                             Set working directory to path
  --path <path>                            Same as --cwd, set working directory
  --usage                                  Open token usage analytics dashboard in browser
  --export error                           Export system error logs to fluxflow-error-<timestamp>.txt
  --update check                           Check for new updates
  --update check latest                    Show the latest version available on npm
  --update [latest]                        Update the app to the latest version (latest is default)`),process.exit(0)),l&&(console.log(`FluxFlow Chat /Commands:
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
  /update latest                           Install latest release`),process.exit(0)),R){let v=e[1]||"latest";if(v==="check"){let u=e[2]==="latest";try{let h=(await(await fetch("https://registry.npmjs.org/fluxflow-cli",{cache:"no-store"})).json())["dist-tags"]?.latest;h||(console.error("Error: Could not retrieve latest version."),process.exit(1)),console.log(u?`Latest version: v${h}`:h!==g?`A new version of FluxFlow is available: v${h} (current: v${g}). Run "fluxflow --update latest" to upgrade.`:`FluxFlow is up to date (v${g}).`)}catch(p){console.error("Error checking for updates:",p.message),process.exit(1)}process.exit(0)}else if(v==="latest"){console.log("Checking latest version and settings...");try{let i=(await(await fetch("https://registry.npmjs.org/fluxflow-cli",{cache:"no-store"})).json())["dist-tags"]?.latest;i||(console.error("Error: Could not retrieve latest version."),process.exit(1)),i===g&&(console.log(`FluxFlow is already up to date (v${g}).`),process.exit(0));let h=async()=>{let t=(await import("react")).default,{useState:L}=t,{render:K,Box:x,Text:y}=await import("ink"),Q=(await import("ink-select-input")).default,Z=(await import("ink-text-input")).default;return new Promise(ee=>{let oe=[{label:"NPM",value:"npm"},{label:"PNPM",value:"pnpm"},{label:"Yarn",value:"yarn"},{label:"Bun",value:"bun"},{label:"Custom Command",value:"custom"}],te=({label:b,isSelected:C})=>t.createElement(x,{width:"100%"},t.createElement(y,{bold:C},"\u2514\u2500 ",C?"\x1B[32m\u25CF\x1B[0m":"\u25CB"," ",b)),T,se=()=>{let[b,C]=L("select"),[ne,ae]=L(""),ie=F=>{F.value==="custom"?C("custom"):_({manager:F.value})},le=F=>{_({manager:"custom",customCommand:F})};return b==="custom"?t.createElement(x,{flexDirection:"column",marginY:1},t.createElement(x,{marginBottom:1},t.createElement(y,{color:"magenta",bold:!0},"\u{1F527} Enter custom update command:")),t.createElement(x,{flexDirection:"row"},t.createElement(y,{color:"cyan",bold:!0},"   \u276F "),t.createElement(Z,{value:ne,onChange:ae,onSubmit:le})),t.createElement(x,{marginTop:1},t.createElement(y,{color:"gray",dimColor:!0,italic:!0},"   (Press Enter to confirm)"))):t.createElement(x,{flexDirection:"column",marginY:1},t.createElement(x,{marginBottom:1},t.createElement(y,{color:"magenta",bold:!0},"\u{1F4E6} Select a package manager for the update:")),t.createElement(Q,{items:oe,onSelect:ie,itemComponent:te,indicatorComponent:()=>null}))},_=b=>{T&&T(),ee(b)},{unmount:re}=K(t.createElement(se,null));T=re})},d,O="",E;try{let{loadSettings:t}=await import("./chunks/settings-HTCI4KRJ.js");E=await t(),d=E?.systemSettings?.updateManager||E?.updateManager}catch{}if(!d){let t=await h();d=t.manager,O=t.customCommand}let f="";d==="pnpm"?f=`pnpm add -g fluxflow-cli@${i}`:d==="bun"?f=`bun add -g fluxflow-cli@${i}`:d==="yarn"?f=`yarn global add fluxflow-cli@${i}`:d==="custom"?f=O||E?.customUpdateCommand||`npm install -g fluxflow-cli@${i}`:f=`npm install -g fluxflow-cli@${i}`,console.log(`Updating FluxFlow to v${i} using ${d}...`),console.log(`Running: ${f}`);let{execSync:J}=await import("child_process");J(f,{stdio:"inherit"}),console.log(`\x1B[32m\u2705 Update successful! FluxFlow updated to v${i}.\x1B[0m`)}catch(u){console.error("\x1B[31m\u274C Update failed:\x1B[0m",u.message),process.exit(1)}process.exit(0)}else console.error("Unknown update command. Available options: --update, --update check, --update check latest, --update latest"),process.exit(1)}}let{default:G}=await import("react"),{render:Y}=await import("ink"),{default:W}=await import("./chunks/app-QSQPQP5X.js");process.env.NODE_NO_WARNINGS="1";let H=["cuimp","Found existing binary","Binary verified","curl.exe not found","Falling back to .bat file","DeprecationWarning"],X=console.log,V=console.warn,z=console.error,A=o=>{let a=o.map(String).join(" ");return H.some(c=>a.includes(c))};console.log=(...o)=>!A(o)&&X(...o),console.warn=(...o)=>!A(o)&&V(...o),console.error=(...o)=>!A(o)&&z(...o);let k=e.findIndex(o=>o==="--cwd"||o==="--path");if(k!==-1&&k+1<e.length){let o=e[k+1],a=await import("path"),c=await import("fs-extra"),m=a.default.resolve(o);try{c.default.existsSync(m)&&c.default.statSync(m).isDirectory()?process.chdir(m):(console.error(`[ERROR] Directory not found: "${o}"`),process.exit(0))}catch(w){console.error(`[ERROR] Failed to change directory to "${o}": ${w.message}`),process.exit(0)}}process.stdout.write("\x1B[2J\x1B[3J\x1B[H"),process.stdout.isTTY&&(process.stdout.write("\x1B]0;FluxFlow\x07"),process.stdout.write("\x1B]633;P;TerminalTitle=FluxFlow\x07"),process.stdout.write("\x1B[?2004h"));let N=()=>{process.stdout.isTTY&&process.stdout.write("\x1B[?2004l")};if(process.on("exit",N),["SIGINT","SIGTERM","SIGHUP"].forEach(o=>{process.once(o,()=>{N(),process.exit(0)})}),e.includes("--playground")){let o=process.cwd();process.argv.push("--original-cwd",o);let{DATA_DIR:a}=await import("./chunks/paths-CHZDSDRF.js"),c=await import("path"),m=await import("fs-extra"),w=c.default.join(a,"playground");try{m.default.ensureDirSync(w),process.chdir(w)}catch{}}Y(G.createElement(W,{args:process.argv.slice(2)}),{exitOnCtrlC:!1})}
