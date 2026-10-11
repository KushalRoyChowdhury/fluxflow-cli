import { spawn, exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

/**
 * Gets map of PID to listening localhost URLs.
 * e.g. { 12020: "http://localhost:52991" }
 */
async function getListeningPortsMap() {
    const portMap = new Map();
    const isWin = process.platform === 'win32';

    try {
        if (isWin) {
            const { stdout } = await execAsync('netstat -ano', { maxBuffer: 10 * 1024 * 1024, windowsHide: true });
            const lines = stdout.split('\n');
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                // TCP  127.0.0.1:3000  0.0.0.0:0  LISTENING  1234
                // or TCP  [::1]:5173  [::]:0  LISTENING  1234
                // or TCP  [::]:5173  [::]:0  LISTENING  1234
                if (parts.length >= 5 && parts[0].toUpperCase() === 'TCP' && parts[3].toUpperCase() === 'LISTENING') {
                    const localAddr = parts[1];
                    const pid = parseInt(parts[4], 10);
                    if (!isNaN(pid)) {
                        const colonIdx = localAddr.lastIndexOf(':');
                        if (colonIdx !== -1) {
                            const port = localAddr.slice(colonIdx + 1);
                            if (port && !portMap.has(pid)) {
                                portMap.set(pid, `http://localhost:${port}`);
                            }
                        }
                    }
                }
            }
        } else {
            // POSIX lsof / ss
            try {
                const { stdout } = await execAsync('lsof -iTCP -sTCP:LISTEN -P -n', { maxBuffer: 10 * 1024 * 1024 });
                const lines = stdout.split('\n').slice(1);
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 9) {
                        const pid = parseInt(parts[1], 10);
                        const nameField = parts[8];
                        const colonIdx = nameField.lastIndexOf(':');
                        if (colonIdx !== -1 && !isNaN(pid) && !portMap.has(pid)) {
                            const port = nameField.slice(colonIdx + 1);
                            portMap.set(pid, `http://localhost:${port}`);
                        }
                    }
                }
            } catch (e) {}
        }
    } catch (err) {}

    return portMap;
}

/**
 * Retrieves process tree (root process and all its descendants) starting from a given PID or current process.pid.
 * Supports Windows (via powershell Get-CimInstance Win32_Process) and POSIX (via ps).
 * 
 * @param {number} rootPid
 * @returns {Promise<Array<{pid: number, ppid: number, name: string, cmd: string, isRoot: boolean, url?: string}>>}
 */
export async function getProcessTree(rootPid = process.pid) {
    const isWin = process.platform === 'win32';
    let allProcesses = [];

    // Parallel fetch process info and listening ports
    const portsPromise = getListeningPortsMap();

    if (isWin) {
        try {
            const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress"`;
            const { stdout } = await execAsync(psCmd, { maxBuffer: 10 * 1024 * 1024, windowsHide: true });
            if (stdout && stdout.trim()) {
                const parsed = JSON.parse(stdout.trim());
                const list = Array.isArray(parsed) ? parsed : [parsed];
                allProcesses = list.map(p => ({
                    pid: Number(p.ProcessId),
                    ppid: Number(p.ParentProcessId),
                    name: p.Name || 'Unknown',
                    cmd: p.CommandLine || p.Name || ''
                }));
            }
        } catch (err) {
            // Fallback: at least return the root process
            return [{
                pid: rootPid,
                ppid: 0,
                name: 'node.exe',
                cmd: process.title || 'node',
                isRoot: true
            }];
        }
    } else {
        try {
            // POSIX ps command
            const { stdout } = await execAsync('ps -axo pid,ppid,comm,args', { maxBuffer: 10 * 1024 * 1024 });
            const lines = stdout.trim().split('\n').slice(1);
            allProcesses = lines.map(line => {
                const parts = line.trim().split(/\s+/);
                const pid = Number(parts[0]);
                const ppid = Number(parts[1]);
                const name = parts[2] || 'Unknown';
                const cmd = parts.slice(3).join(' ') || name;
                return { pid, ppid, name, cmd };
            }).filter(p => !isNaN(p.pid));
        } catch (err) {
            return [{
                pid: rootPid,
                ppid: 0,
                name: 'node',
                cmd: process.title || 'node',
                isRoot: true
            }];
        }
    }

    const portMap = await portsPromise;

    // Traverse recursively or using queue to find root and all descendants
    const pidMap = new Map();
    const childrenMap = new Map();

    for (const proc of allProcesses) {
        pidMap.set(proc.pid, proc);
        if (!childrenMap.has(proc.ppid)) {
            childrenMap.set(proc.ppid, []);
        }
        childrenMap.get(proc.ppid).push(proc.pid);
    }

    const tree = [];
    const rootInfo = pidMap.get(rootPid) || {
        pid: rootPid,
        ppid: 0,
        name: isWin ? 'node.exe' : 'node',
        cmd: process.title || 'node'
    };
    rootInfo.isRoot = true;
    if (portMap.has(rootPid)) {
        rootInfo.url = portMap.get(rootPid);
    }
    tree.push(rootInfo);

    const queue = [rootPid];
    const visited = new Set([rootPid]);

    const SYSTEM_IGNORE_NAMES = new Set([
        'conhost.exe',
        'cmd.exe',
        'powershell.exe',
        'pwsh.exe',
        'wmic.exe'
    ]);

    while (queue.length > 0) {
        const currPid = queue.shift();
        const children = childrenMap.get(currPid) || [];
        for (const childPid of children) {
            if (!visited.has(childPid)) {
                visited.add(childPid);
                const childProc = pidMap.get(childPid);
                if (childProc) {
                    childProc.isRoot = false;
                    if (portMap.has(childPid)) {
                        childProc.url = portMap.get(childPid);
                    }
                    // Filter noisy system console / shell wrappers unless they are bound to a port
                    const procName = (childProc.name || '').toLowerCase();
                    if (childProc.url || !SYSTEM_IGNORE_NAMES.has(procName)) {
                        tree.push(childProc);
                    }
                    queue.push(childPid);
                }
            }
        }
    }

    return tree;
}

/**
 * Terminates a process by PID.
 * On Windows, uses taskkill /pid <PID> /f /t.
 * On POSIX, sends SIGKILL.
 * 
 * @param {number} pid
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function killProcess(pid) {
    if (!pid || isNaN(pid)) {
        return { success: false, message: `Invalid PID: ${pid}` };
    }

    const isWin = process.platform === 'win32';
    try {
        if (isWin) {
            await execAsync(`taskkill /pid ${pid} /f /t`, { windowsHide: true });
        } else {
            process.kill(pid, 'SIGKILL');
        }
        return { success: true, message: `Process ${pid} terminated successfully.` };
    } catch (err) {
        return { success: false, message: `Failed to terminate process ${pid}: ${err.message}` };
    }
}
