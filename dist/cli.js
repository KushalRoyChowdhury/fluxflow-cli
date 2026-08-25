#!/usr/bin/env node
import{spawn as ne}from"child_process";import{fileURLToPath as _}from"url";import ie from"os";import A from"dotenv";A.config({quiet:!0});A.config({path:"./fluxflow.env",override:!0,quiet:!0});A.config({path:"./.fluxflow.env",override:!0,quiet:!0});var le=ie.totalmem(),L=le/(1024*1024),ce=.5,ue=Math.floor(L*ce),D=process.argv.slice(2),B=D.indexOf("--allocation"),s=B!==-1?parseInt(D[B+1],10):NaN,pe=process.env.EXPERIMENTAL_MEMORY_MANAGER==="true"||process.env.EXPERIMENTAL_MEMORY_MANAGER==="1"||process.env.EXPERIMENTAL_MEMORY_MANAGER===!0||process.env.EXPERIMENTAL_MEMORY_MANAGER===1||!1,me=!isNaN(s)||pe||!1;!isNaN(s)&&s<64&&(console.error(`
[ERROR] Allocation value '${s} MB' is too low. Minimum: 64 MB, Recommended: 4096 MB.
`),process.exit(1));var y=Math.floor(L*.75),de=!isNaN(s)&&s>0?Math.min(s,y):Math.max(1536,Math.min(32768,ue)),ge=_(import.meta.url).endsWith(".js");if(ge&&!process.execArgv.some(o=>o.includes("max-old-space-size"))&&me)Number.isNaN(s)||(console.log(`
[MEMORY] Starting with: '${s>y?y:s} MB' Allocation${s>y?" (Max allowed: '"+y+" MB')":""}. Please Wait...`),await new Promise(u=>setTimeout(u,5e3))),ne(process.execPath,[`--max-old-space-size=${de}`,"--expose-gc","--max-semi-space-size=1",_(import.meta.url),...process.argv.slice(2)],{stdio:"inherit"}).on("exit",u=>process.exit(u||0));else{let o=process.argv.slice(2),u=o.includes("--help")&&o[o.indexOf("--help")+1]==="commands",F=o.includes("--help")&&!u,T=o.includes("--version")||o.includes("-v"),P=o[0]==="--update",R=o[0]==="--export";if(o[0]==="--usage"||o.includes("--usage")||o[0]==="--budget"||o.includes("--budget")){let{openUsageDashboard:e}=await import("./chunks/usageServer-C2QUDNFE.js"),{url:a}=await e();console.log(`
\u2726 FluxFlow Token Usage & Analytics Dashboard
\u2800\u2800\u2514\u2500 Serving at: ${a}
\u2800\u2800\u2514\u2500 Opened in default browser. Press Ctrl+C to stop.
`),await new Promise(()=>{})}if(T||F||u||P||R){let e=await import("fs"),a=await import("path"),{fileURLToPath:n}=await import("url"),p=a.join(a.dirname(n(import.meta.url)),"../package.json"),m=JSON.parse(e.readFileSync(p,"utf8")).version;if(R){let w=(o[1]||"").toLowerCase();if(w==="error"||w==="logs")try{let{exportErrorLogs:i}=await import("./chunks/export-NRMLNZUN.js"),l=await i();console.log(`[EXPORT LOGS] Exported ${l.entryCount} error log entries (FluxFlow: ${l.fluxflowCount}, Memory: ${l.memoryCount}) to "${l.exportFile}"`),process.exit(0)}catch(i){console.error(`[EXPORT ERROR] Failed to export error logs: ${i.message}`),process.exit(1)}else console.error(`[EXPORT ERROR] Invalid export target "${o[1]||""}". --export only supports 'error'.
Usage: fluxflow --export error`),process.exit(1)}if(T&&(console.log(`v${m}`),process.exit(0)),F&&(console.log(`FluxFlow CLI Arguments:
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
  /update latest                           Install latest release`),process.exit(0)),P){let w=o[1]||"latest";if(w==="check"){let i=o[2]==="latest";try{let f=(await(await fetch("https://registry.npmjs.org/fluxflow-cli",{cache:"no-store"})).json())["dist-tags"]?.latest;f||(console.error("Error: Could not retrieve latest version."),process.exit(1)),console.log(i?`Latest version: v${f}`:f!==m?`A new version of FluxFlow is available: v${f} (current: v${m}). Run "fluxflow --update latest" to upgrade.`:`FluxFlow is up to date (v${m}).`)}catch(l){console.error("Error checking for updates:",l.message),process.exit(1)}process.exit(0)}else if(w==="latest"){console.log("Checking latest version and settings...");try{let r=(await(await fetch("https://registry.npmjs.org/fluxflow-cli",{cache:"no-store"})).json())["dist-tags"]?.latest;r||(console.error("Error: Could not retrieve latest version."),process.exit(1)),r===m&&(console.log(`FluxFlow is already up to date (v${m}).`),process.exit(0));let f=async()=>{let t=(await import("react")).default,{useState:$}=t,{render:q,Box:g,Text:h}=await import("ink"),z=(await import("ink-select-input")).default,J=(await import("ink-text-input")).default;return new Promise(K=>{let Q=[{label:"NPM",value:"npm"},{label:"PNPM",value:"pnpm"},{label:"Yarn",value:"yarn"},{label:"Bun",value:"bun"},{label:"Custom Command",value:"custom"}],Z=({label:v,isSelected:M})=>t.createElement(g,{width:"100%"},t.createElement(h,{bold:M},"\u2514\u2500 ",M?"\x1B[32m\u25CF\x1B[0m":"\u25CB"," ",v)),k,ee=()=>{let[v,M]=$("select"),[te,se]=$(""),ae=E=>{E.value==="custom"?M("custom"):O({manager:E.value})},re=E=>{O({manager:"custom",customCommand:E})};return v==="custom"?t.createElement(g,{flexDirection:"column",marginY:1},t.createElement(g,{marginBottom:1},t.createElement(h,{color:"magenta",bold:!0},"\u{1F527} Enter custom update command:")),t.createElement(g,{flexDirection:"row"},t.createElement(h,{color:"cyan",bold:!0},"   \u276F "),t.createElement(J,{value:te,onChange:se,onSubmit:re})),t.createElement(g,{marginTop:1},t.createElement(h,{color:"gray",dimColor:!0,italic:!0},"   (Press Enter to confirm)"))):t.createElement(g,{flexDirection:"column",marginY:1},t.createElement(g,{marginBottom:1},t.createElement(h,{color:"magenta",bold:!0},"\u{1F4E6} Select a package manager for the update:")),t.createElement(z,{items:Q,onSelect:ae,itemComponent:Z,indicatorComponent:()=>null}))},O=v=>{k&&k(),K(v)},{unmount:oe}=q(t.createElement(ee,null));k=oe})},c,N="",b;try{let{loadSettings:t}=await import("./chunks/settings-TAIBP5U4.js");b=await t(),c=b?.systemSettings?.updateManager||b?.updateManager}catch{}if(!c){let t=await f();c=t.manager,N=t.customCommand}let d="";c==="pnpm"?d=`pnpm add -g fluxflow-cli@${r}`:c==="bun"?d=`bun add -g fluxflow-cli@${r}`:c==="yarn"?d=`yarn global add fluxflow-cli@${r}`:c==="custom"?d=N||b?.customUpdateCommand||`npm install -g fluxflow-cli@${r}`:d=`npm install -g fluxflow-cli@${r}`,console.log(`Updating FluxFlow to v${r} using ${c}...`),console.log(`Running: ${d}`);let{execSync:X}=await import("child_process");X(d,{stdio:"inherit"}),console.log(`\x1B[32m\u2705 Update successful! FluxFlow updated to v${r}.\x1B[0m`)}catch(i){console.error("\x1B[31m\u274C Update failed:\x1B[0m",i.message),process.exit(1)}process.exit(0)}else console.error("Unknown update command. Available options: --update, --update check, --update check latest, --update latest"),process.exit(1)}}let{default:U}=await import("react"),{render:j}=await import("ink"),{default:Y}=await import("./chunks/app-WQSGYJ4N.js");process.env.NODE_NO_WARNINGS="1";let G=["cuimp","Found existing binary","Binary verified","curl.exe not found","Falling back to .bat file","DeprecationWarning"],H=console.log,W=console.warn,V=console.error,S=e=>{let a=e.map(String).join(" ");return G.some(n=>a.includes(n))};console.log=(...e)=>!S(e)&&H(...e),console.warn=(...e)=>!S(e)&&W(...e),console.error=(...e)=>!S(e)&&V(...e);let C=o.findIndex(e=>e==="--cwd"||e==="--path");if(C!==-1&&C+1<o.length){let e=o[C+1],a=await import("path"),n=await import("fs-extra"),p=a.default.resolve(e);try{n.default.existsSync(p)&&n.default.statSync(p).isDirectory()?process.chdir(p):(console.error(`[ERROR] Directory not found: "${e}"`),process.exit(0))}catch(x){console.error(`[ERROR] Failed to change directory to "${e}": ${x.message}`),process.exit(0)}}process.stdout.write("\x1B[2J\x1B[3J\x1B[H"),process.stdout.isTTY&&(process.stdout.write("\x1B]0;FluxFlow\x07"),process.stdout.write("\x1B]633;P;TerminalTitle=FluxFlow\x07"),process.stdout.write("\x1B[?2004h"));let I=()=>{process.stdout.isTTY&&process.stdout.write("\x1B[?2004l")};if(process.on("exit",I),["SIGINT","SIGTERM","SIGHUP"].forEach(e=>{process.once(e,()=>{I(),process.exit(0)})}),o.includes("--playground")){let e=process.cwd();process.argv.push("--original-cwd",e);let{DATA_DIR:a}=await import("./chunks/paths-R3DD7CRF.js"),n=await import("path"),p=await import("fs-extra"),x=n.default.join(a,"playground");try{p.default.ensureDirSync(x),process.chdir(x)}catch{}}j(U.createElement(Y,{args:process.argv.slice(2)}),{exitOnCtrlC:!1})}
