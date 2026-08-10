#!/usr/bin/env node
import{spawn as ae}from"child_process";import{fileURLToPath as L}from"url";import re from"os";import ne from"dotenv";ne.config({quiet:!0});var ie=re.totalmem(),O=ie/(1024*1024),le=.5,ce=Math.floor(O*le),R=process.argv.slice(2),N=R.indexOf("--allocation"),a=N!==-1?parseInt(R[N+1],10):NaN;!isNaN(a)&&a<64&&(console.error(`
[ERROR] Allocation value '${a} MB' is too low. Minimum: 64 MB, Recommended: 4096 MB.
`),process.exit(1));var w=Math.floor(O*.75),me=!isNaN(a)&&a>0?Math.min(a,w):Math.max(1536,Math.min(32768,ce)),ue=L(import.meta.url).endsWith(".js");if(ue&&!process.execArgv.some(o=>o.includes("max-old-space-size")))Number.isNaN(a)||(console.log(`
[MEMORY] Starting with: '${a>w?w:a} MB' Allocation${a>w?" (Max allowed: '"+w+" MB')":""}. Please Wait...`),await new Promise(l=>setTimeout(l,5e3))),ae(process.execPath,[`--max-old-space-size=${me}`,"--expose-gc","--max-semi-space-size=1",L(import.meta.url),...process.argv.slice(2)],{stdio:"inherit"}).on("exit",l=>process.exit(l||0));else{let o=process.argv.slice(2),l=o.includes("--help")&&o[o.indexOf("--help")+1]==="commands",M=o.includes("--help")&&!l,T=o.includes("--version")||o.includes("-v"),A=o[0]==="--update",P=o[0]==="--export";if(T||M||l||A||P){let t=await import("fs"),p=await import("path"),{fileURLToPath:g}=await import("url"),C=p.join(p.dirname(g(import.meta.url)),"../package.json"),c=JSON.parse(t.readFileSync(C,"utf8")).version;if(P){let f=(o[1]||"").toLowerCase();if(f==="error"||f==="logs")try{let{exportErrorLogs:r}=await import("./chunks/export-JZFBZGGZ.js"),n=await r();console.log(`[EXPORT LOGS] Exported ${n.entryCount} error log entries (FluxFlow: ${n.fluxflowCount}, Memory: ${n.memoryCount}) to "${n.exportFile}"`),process.exit(0)}catch(r){console.error(`[EXPORT ERROR] Failed to export error logs: ${r.message}`),process.exit(1)}else console.error(`[EXPORT ERROR] Invalid export target "${o[1]||""}". --export only supports 'error'.
Usage: fluxflow --export error`),process.exit(1)}if(T&&(console.log(`v${c}`),process.exit(0)),M&&(console.log(`FluxFlow CLI Arguments:
  --mode <flux|flow>                   Set startup mode (flux: Agent / flow: Chat)
  --model <model_name>                 Set startup AI model
  --key <key@provider>                 Set API key and provider
  --provider <google|deepseek|openrouter> Override default provider
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
  --export error                       Export system error logs to fluxflow-error-<timestamp>.txt
  --update check                       Check for new updates
  --update check latest                Show the latest version available on npm
  --update [latest]                    Update the app to the latest version (latest is default)`),process.exit(0)),l&&(console.log(`FluxFlow Chat /Commands:
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
  /reset                                   Wipe all project data
  /about                                   Project info & credits
  /changelog                               View latest updates
  /docs                                    View documentation
  /fluxflow init                           Create FluxFlow.md template
  /update check                            Check for new version
  /update latest                           Install latest release`),process.exit(0)),A){let f=o[1]||"latest";if(f==="check"){let r=o[2]==="latest";try{let d=(await(await fetch("https://registry.npmjs.org/fluxflow-cli",{cache:"no-store"})).json())["dist-tags"]?.latest;d||(console.error("Error: Could not retrieve latest version."),process.exit(1)),console.log(r?`Latest version: v${d}`:d!==c?`A new version of FluxFlow is available: v${d} (current: v${c}). Run "fluxflow --update latest" to upgrade.`:`FluxFlow is up to date (v${c}).`)}catch(n){console.error("Error checking for updates:",n.message),process.exit(1)}process.exit(0)}else if(f==="latest"){console.log("Checking latest version and settings...");try{let s=(await(await fetch("https://registry.npmjs.org/fluxflow-cli",{cache:"no-store"})).json())["dist-tags"]?.latest;s||(console.error("Error: Could not retrieve latest version."),process.exit(1)),s===c&&(console.log(`FluxFlow is already up to date (v${c}).`),process.exit(0));let d=async()=>{let e=(await import("react")).default,{useState:$}=e,{render:z,Box:u,Text:x}=await import("ink"),G=(await import("ink-select-input")).default,J=(await import("ink-text-input")).default;return new Promise(q=>{let X=[{label:"NPM",value:"npm"},{label:"PNPM",value:"pnpm"},{label:"Yarn",value:"yarn"},{label:"Bun",value:"bun"},{label:"Custom Command",value:"custom"}],K=({label:h,isSelected:y})=>e.createElement(u,{width:"100%"},e.createElement(x,{bold:y},"\u2514\u2500 ",y?"\x1B[32m\u25CF\x1B[0m":"\u25CB"," ",h)),F,Q=()=>{let[h,y]=$("select"),[ee,oe]=$(""),te=b=>{b.value==="custom"?y("custom"):B({manager:b.value})},se=b=>{B({manager:"custom",customCommand:b})};return h==="custom"?e.createElement(u,{flexDirection:"column",marginY:1},e.createElement(u,{marginBottom:1},e.createElement(x,{color:"magenta",bold:!0},"\u{1F527} Enter custom update command:")),e.createElement(u,{flexDirection:"row"},e.createElement(x,{color:"cyan",bold:!0},"   \u276F "),e.createElement(J,{value:ee,onChange:oe,onSubmit:se})),e.createElement(u,{marginTop:1},e.createElement(x,{color:"gray",dimColor:!0,italic:!0},"   (Press Enter to confirm)"))):e.createElement(u,{flexDirection:"column",marginY:1},e.createElement(u,{marginBottom:1},e.createElement(x,{color:"magenta",bold:!0},"\u{1F4E6} Select a package manager for the update:")),e.createElement(G,{items:X,onSelect:te,itemComponent:K,indicatorComponent:()=>null}))},B=h=>{F&&F(),q(h)},{unmount:Z}=z(e.createElement(Q,null));F=Z})},i,I="",v;try{let{loadSettings:e}=await import("./chunks/settings-IY24HSRP.js");v=await e(),i=v?.systemSettings?.updateManager||v?.updateManager}catch{}if(!i){let e=await d();i=e.manager,I=e.customCommand}let m="";i==="pnpm"?m=`pnpm add -g fluxflow-cli@${s}`:i==="bun"?m=`bun add -g fluxflow-cli@${s}`:i==="yarn"?m=`yarn global add fluxflow-cli@${s}`:i==="custom"?m=I||v?.customUpdateCommand||`npm install -g fluxflow-cli@${s}`:m=`npm install -g fluxflow-cli@${s}`,console.log(`Updating FluxFlow to v${s} using ${i}...`),console.log(`Running: ${m}`);let{execSync:Y}=await import("child_process");Y(m,{stdio:"inherit"}),console.log(`\x1B[32m\u2705 Update successful! FluxFlow updated to v${s}.\x1B[0m`)}catch(r){console.error("\x1B[31m\u274C Update failed:\x1B[0m",r.message),process.exit(1)}process.exit(0)}else console.error("Unknown update command. Available options: --update, --update check, --update check latest, --update latest"),process.exit(1)}}let{default:D}=await import("react"),{render:U}=await import("ink"),{default:_}=await import("./chunks/app-4M34YBXM.js");process.env.NODE_NO_WARNINGS="1";let j=["cuimp","Found existing binary","Binary verified","curl.exe not found","Falling back to .bat file","DeprecationWarning"],H=console.log,W=console.warn,V=console.error,S=t=>{let p=t.map(String).join(" ");return j.some(g=>p.includes(g))};console.log=(...t)=>!S(t)&&H(...t),console.warn=(...t)=>!S(t)&&W(...t),console.error=(...t)=>!S(t)&&V(...t),process.stdout.write("\x1B[2J\x1B[3J\x1B[H"),process.stdout.isTTY&&(process.stdout.write("\x1B]0;FluxFlow\x07"),process.stdout.write("\x1B]633;P;TerminalTitle=FluxFlow\x07"),process.stdout.write("\x1B[?2004h"));let E=()=>{process.stdout.isTTY&&process.stdout.write("\x1B[?2004l")};if(process.on("exit",E),["SIGINT","SIGTERM","SIGHUP"].forEach(t=>{process.once(t,()=>{E(),process.exit(0)})}),o.includes("--playground")){let t=process.cwd();process.argv.push("--original-cwd",t);let{DATA_DIR:p}=await import("./chunks/paths-HYQFU6D2.js"),g=await import("path"),C=await import("fs-extra"),k=g.default.join(p,"playground");try{C.default.ensureDirSync(k),process.chdir(k)}catch{}}U(D.createElement(_,{args:process.argv.slice(2)}),{exitOnCtrlC:!1})}
