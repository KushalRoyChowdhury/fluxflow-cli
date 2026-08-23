#!/usr/bin/env node
import{spawn as ne}from"child_process";import{fileURLToPath as _}from"url";import ie from"os";import k from"dotenv";k.config({quiet:!0});k.config({path:"./fluxflow.env",override:!0,quiet:!0});k.config({path:"./.fluxflow.env",override:!0,quiet:!0});var le=ie.totalmem(),L=le/(1024*1024),ce=.5,me=Math.floor(L*ce),D=process.argv.slice(2),O=D.indexOf("--allocation"),s=O!==-1?parseInt(D[O+1],10):NaN,pe=process.env.EXPERIMENTAL_MEMORY_MANAGER==="true"||process.env.EXPERIMENTAL_MEMORY_MANAGER==="1"||process.env.EXPERIMENTAL_MEMORY_MANAGER===!0||process.env.EXPERIMENTAL_MEMORY_MANAGER===1||!1,ue=!isNaN(s)||pe||!1;!isNaN(s)&&s<64&&(console.error(`
[ERROR] Allocation value '${s} MB' is too low. Minimum: 64 MB, Recommended: 4096 MB.
`),process.exit(1));var y=Math.floor(L*.75),de=!isNaN(s)&&s>0?Math.min(s,y):Math.max(1536,Math.min(32768,me)),ge=_(import.meta.url).endsWith(".js");if(ge&&!process.execArgv.some(t=>t.includes("max-old-space-size"))&&ue)Number.isNaN(s)||(console.log(`
[MEMORY] Starting with: '${s>y?y:s} MB' Allocation${s>y?" (Max allowed: '"+y+" MB')":""}. Please Wait...`),await new Promise(m=>setTimeout(m,5e3))),ne(process.execPath,[`--max-old-space-size=${de}`,"--expose-gc","--max-semi-space-size=1",_(import.meta.url),...process.argv.slice(2)],{stdio:"inherit"}).on("exit",m=>process.exit(m||0));else{let t=process.argv.slice(2),m=t.includes("--help")&&t[t.indexOf("--help")+1]==="commands",F=t.includes("--help")&&!m,T=t.includes("--version")||t.includes("-v"),R=t[0]==="--update",P=t[0]==="--export";if(T||F||m||R||P){let e=await import("fs"),a=await import("path"),{fileURLToPath:n}=await import("url"),p=a.join(a.dirname(n(import.meta.url)),"../package.json"),u=JSON.parse(e.readFileSync(p,"utf8")).version;if(P){let h=(t[1]||"").toLowerCase();if(h==="error"||h==="logs")try{let{exportErrorLogs:i}=await import("./chunks/export-NRMLNZUN.js"),l=await i();console.log(`[EXPORT LOGS] Exported ${l.entryCount} error log entries (FluxFlow: ${l.fluxflowCount}, Memory: ${l.memoryCount}) to "${l.exportFile}"`),process.exit(0)}catch(i){console.error(`[EXPORT ERROR] Failed to export error logs: ${i.message}`),process.exit(1)}else console.error(`[EXPORT ERROR] Invalid export target "${t[1]||""}". --export only supports 'error'.
Usage: fluxflow --export error`),process.exit(1)}if(T&&(console.log(`v${u}`),process.exit(0)),F&&(console.log(`FluxFlow CLI Arguments:
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
 --export error                       Export system error logs to fluxflow-error-<timestamp>.txt
 --update check                       Check for new updates
 --update check latest                Show the latest version available on npm
 --update [latest]                    Update the app to the latest version (latest is default)`),process.exit(0)),m&&(console.log(`FluxFlow Chat /Commands:
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
  /update latest                           Install latest release`),process.exit(0)),R){let h=t[1]||"latest";if(h==="check"){let i=t[2]==="latest";try{let f=(await(await fetch("https://registry.npmjs.org/fluxflow-cli",{cache:"no-store"})).json())["dist-tags"]?.latest;f||(console.error("Error: Could not retrieve latest version."),process.exit(1)),console.log(i?`Latest version: v${f}`:f!==u?`A new version of FluxFlow is available: v${f} (current: v${u}). Run "fluxflow --update latest" to upgrade.`:`FluxFlow is up to date (v${u}).`)}catch(l){console.error("Error checking for updates:",l.message),process.exit(1)}process.exit(0)}else if(h==="latest"){console.log("Checking latest version and settings...");try{let r=(await(await fetch("https://registry.npmjs.org/fluxflow-cli",{cache:"no-store"})).json())["dist-tags"]?.latest;r||(console.error("Error: Could not retrieve latest version."),process.exit(1)),r===u&&(console.log(`FluxFlow is already up to date (v${u}).`),process.exit(0));let f=async()=>{let o=(await import("react")).default,{useState:$}=o,{render:q,Box:g,Text:w}=await import("ink"),z=(await import("ink-select-input")).default,J=(await import("ink-text-input")).default;return new Promise(K=>{let Q=[{label:"NPM",value:"npm"},{label:"PNPM",value:"pnpm"},{label:"Yarn",value:"yarn"},{label:"Bun",value:"bun"},{label:"Custom Command",value:"custom"}],Z=({label:v,isSelected:b})=>o.createElement(g,{width:"100%"},o.createElement(w,{bold:b},"\u2514\u2500 ",b?"\x1B[32m\u25CF\x1B[0m":"\u25CB"," ",v)),A,ee=()=>{let[v,b]=$("select"),[te,se]=$(""),re=E=>{E.value==="custom"?b("custom"):B({manager:E.value})},ae=E=>{B({manager:"custom",customCommand:E})};return v==="custom"?o.createElement(g,{flexDirection:"column",marginY:1},o.createElement(g,{marginBottom:1},o.createElement(w,{color:"magenta",bold:!0},"\u{1F527} Enter custom update command:")),o.createElement(g,{flexDirection:"row"},o.createElement(w,{color:"cyan",bold:!0},"   \u276F "),o.createElement(J,{value:te,onChange:se,onSubmit:ae})),o.createElement(g,{marginTop:1},o.createElement(w,{color:"gray",dimColor:!0,italic:!0},"   (Press Enter to confirm)"))):o.createElement(g,{flexDirection:"column",marginY:1},o.createElement(g,{marginBottom:1},o.createElement(w,{color:"magenta",bold:!0},"\u{1F4E6} Select a package manager for the update:")),o.createElement(z,{items:Q,onSelect:re,itemComponent:Z,indicatorComponent:()=>null}))},B=v=>{A&&A(),K(v)},{unmount:oe}=q(o.createElement(ee,null));A=oe})},c,N="",M;try{let{loadSettings:o}=await import("./chunks/settings-NKBYU2YV.js");M=await o(),c=M?.systemSettings?.updateManager||M?.updateManager}catch{}if(!c){let o=await f();c=o.manager,N=o.customCommand}let d="";c==="pnpm"?d=`pnpm add -g fluxflow-cli@${r}`:c==="bun"?d=`bun add -g fluxflow-cli@${r}`:c==="yarn"?d=`yarn global add fluxflow-cli@${r}`:c==="custom"?d=N||M?.customUpdateCommand||`npm install -g fluxflow-cli@${r}`:d=`npm install -g fluxflow-cli@${r}`,console.log(`Updating FluxFlow to v${r} using ${c}...`),console.log(`Running: ${d}`);let{execSync:X}=await import("child_process");X(d,{stdio:"inherit"}),console.log(`\x1B[32m\u2705 Update successful! FluxFlow updated to v${r}.\x1B[0m`)}catch(i){console.error("\x1B[31m\u274C Update failed:\x1B[0m",i.message),process.exit(1)}process.exit(0)}else console.error("Unknown update command. Available options: --update, --update check, --update check latest, --update latest"),process.exit(1)}}let{default:U}=await import("react"),{render:j}=await import("ink"),{default:Y}=await import("./chunks/app-JU4DHKRO.js");process.env.NODE_NO_WARNINGS="1";let G=["cuimp","Found existing binary","Binary verified","curl.exe not found","Falling back to .bat file","DeprecationWarning"],H=console.log,W=console.warn,V=console.error,S=e=>{let a=e.map(String).join(" ");return G.some(n=>a.includes(n))};console.log=(...e)=>!S(e)&&H(...e),console.warn=(...e)=>!S(e)&&W(...e),console.error=(...e)=>!S(e)&&V(...e);let C=t.findIndex(e=>e==="--cwd"||e==="--path");if(C!==-1&&C+1<t.length){let e=t[C+1],a=await import("path"),n=await import("fs-extra"),p=a.default.resolve(e);try{n.default.existsSync(p)&&n.default.statSync(p).isDirectory()?process.chdir(p):(console.error(`[ERROR] Directory not found: "${e}"`),process.exit(0))}catch(x){console.error(`[ERROR] Failed to change directory to "${e}": ${x.message}`),process.exit(0)}}process.stdout.write("\x1B[2J\x1B[3J\x1B[H"),process.stdout.isTTY&&(process.stdout.write("\x1B]0;FluxFlow\x07"),process.stdout.write("\x1B]633;P;TerminalTitle=FluxFlow\x07"),process.stdout.write("\x1B[?2004h"));let I=()=>{process.stdout.isTTY&&process.stdout.write("\x1B[?2004l")};if(process.on("exit",I),["SIGINT","SIGTERM","SIGHUP"].forEach(e=>{process.once(e,()=>{I(),process.exit(0)})}),t.includes("--playground")){let e=process.cwd();process.argv.push("--original-cwd",e);let{DATA_DIR:a}=await import("./chunks/paths-R3DD7CRF.js"),n=await import("path"),p=await import("fs-extra"),x=n.default.join(a,"playground");try{p.default.ensureDirSync(x),process.chdir(x)}catch{}}j(U.createElement(Y,{args:process.argv.slice(2)}),{exitOnCtrlC:!1})}
