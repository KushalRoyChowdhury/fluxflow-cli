import http from 'http';
import { exec } from 'child_process';
import { getAllUsageData } from './usage.js';
import { DATA_DIR } from './paths.js';
import { FLUXFLOW_LOGO_BASE64 } from './logoBase64.js';

let activeServer = null;
let activePort = null;

function generateDashboardHtml() {
    const logoDataUri = FLUXFLOW_LOGO_BASE64;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FluxFlow Token Usage & Analytics Dashboard</title>
    ${logoDataUri ? `<link rel="icon" type="image/png" href="${logoDataUri}">` : ''}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
    <style>
        :root {
            --bg-base: #07090e;
            --bg-card: rgba(16, 22, 34, 0.75);
            --bg-card-hover: rgba(22, 30, 48, 0.85);
            --border-subtle: rgba(255, 255, 255, 0.08);
            --border-glow: rgba(56, 189, 248, 0.25);
            --text-main: #f1f5f9;
            --text-muted: #94a3b8;
            --text-dim: #64748b;
            --accent-cyan: #38bdf8;
            --accent-emerald: #10b981;
            --accent-violet: #a855f7;
            --accent-amber: #f59e0b;
            --accent-rose: #f43f5e;
            --accent-blue: #3b82f6;
            --radius-lg: 16px;
            --radius-md: 10px;
            --radius-sm: 6px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background-color: var(--bg-base);
            color: var(--text-main);
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
            -webkit-user-select: none;
            background-image:
                radial-gradient(circle at 15% 10%, rgba(56, 189, 248, 0.08) 0%, transparent 45%),
                radial-gradient(circle at 85% 20%, rgba(168, 85, 247, 0.08) 0%, transparent 45%),
                radial-gradient(circle at 50% 80%, rgba(16, 185, 129, 0.06) 0%, transparent 50%);
            background-attachment: fixed;
        }

        input {
            user-select: auto;
            -webkit-user-select: auto;
        }

        .mono {
            font-family: 'JetBrains Mono', monospace;
        }

        .glass-panel {
            background: var(--bg-card);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-lg);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .glass-panel:hover {
            border-color: rgba(255, 255, 255, 0.14);
        }

        header {
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(24px);
            background: rgba(7, 9, 14, 0.3);
            border-bottom: 1px solid var(--border-subtle);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .brand-container {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .brand-badge {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: linear-gradient(135deg, #38bdf8 0%, #a855f7 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 1.2rem;
            color: #fff;
            box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
        }

        .brand-title {
            font-size: clamp(1.1rem, 1.6vw, 1.4rem);
            font-weight: 700;
            letter-spacing: -0.02em;
            background: linear-gradient(to right, #ffffff, #94a3b8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .brand-subtitle {
            font-size: clamp(0.7rem, 0.9vw, 0.8rem);
            color: var(--text-dim);
            font-weight: 500;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .status-pill {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 9999px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.25);
            color: #34d399;
            font-size: clamp(0.75rem, 0.9vw, 0.825rem);
            font-weight: 600;
        }

        .pulse-dot {
            width: 8px;
            height: 8px;
            background-color: #10b981;
            border-radius: 50%;
            box-shadow: 0 0 8px #10b981;
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }

        @keyframes pulse-ring {
            0% { transform: scale(0.9); opacity: 0.8; }
            50% { transform: scale(1.3); opacity: 1; filter: drop-shadow(0 0 4px #10b981); }
            100% { transform: scale(0.9); opacity: 0.8; }
        }

        .btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-subtle);
            color: var(--text-main);
            padding: 8px 16px;
            border-radius: var(--radius-md);
            font-size: clamp(0.78rem, 0.9vw, 0.85rem);
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
        }

        .btn:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.25);
            transform: translateY(-1px);
        }

        .btn-primary {
            background: linear-gradient(135deg, #0284c7 0%, #6366f1 100%);
            border: none;
            color: white;
            box-shadow: 0 4px 14px rgba(2, 132, 199, 0.3);
        }

        .btn-primary:hover {
            box-shadow: 0 6px 20px rgba(2, 132, 199, 0.5);
            background: linear-gradient(135deg, #0369a1 0%, #4f46e5 100%);
        }

        .container {
            max-width: 1480px;
            margin: 0 auto;
            padding: clamp(1rem, 2.5vw, 2.5rem);
            display: flex;
            flex-direction: column;
            gap: clamp(1.25rem, 2vw, 2rem);
        }

        .controls-bar {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            padding: 1rem 1.5rem;
        }

        .tabs-group {
            display: flex;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 4px;
            gap: 4px;
        }

        .tab-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            padding: 6px 16px;
            font-size: clamp(0.78rem, 0.9vw, 0.85rem);
            font-weight: 600;
            border-radius: var(--radius-sm);
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .tab-btn.active {
            background: rgba(56, 189, 248, 0.15);
            color: var(--accent-cyan);
            border: 1px solid rgba(56, 189, 248, 0.3);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.25rem;
        }

        .metric-card {
            padding: clamp(1.15rem, 1.8vw, 1.6rem);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .metric-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: linear-gradient(90deg, transparent, var(--card-accent, var(--accent-cyan)), transparent);
            opacity: 0.8;
        }

        .metric-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 0.75rem;
        }

        .metric-label {
            font-size: clamp(0.75rem, 0.9vw, 0.825rem);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
        }

        .metric-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.04);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.1rem;
            color: var(--card-accent, var(--accent-cyan));
        }

        .metric-value {
            font-size: clamp(1.2rem, 1.65vw, 1.65rem);
            font-weight: 800;
            letter-spacing: -0.02em;
            color: var(--text-main);
            margin-bottom: 0.4rem;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .metric-sub {
            font-size: clamp(0.725rem, 0.85vw, 0.8rem);
            color: var(--text-dim);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .badge-positive {
            color: var(--accent-emerald);
            background: rgba(16, 185, 129, 0.1);
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
        }

        .badge-info {
            color: var(--accent-cyan);
            background: rgba(56, 189, 248, 0.1);
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
        }

        .chart-row {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 1.5rem;
        }

        @media (max-width: 1024px) {
            .chart-row {
                grid-template-columns: 1fr;
            }
        }

        .chart-box {
            padding: clamp(1.15rem, 1.8vw, 1.6rem);
            display: flex;
            flex-direction: column;
            gap: 1rem;
            min-height: 420px;
        }

        .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 0.5rem;
        }

        .chart-title-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .chart-title {
            font-size: clamp(1rem, 1.3vw, 1.2rem);
            font-weight: 700;
            color: var(--text-main);
        }

        .chart-subtitle {
            font-size: clamp(0.75rem, 0.9vw, 0.85rem);
            color: var(--text-muted);
        }

        .chart-controls {
            display: flex;
            gap: 6px;
        }

        .chart-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-subtle);
            color: var(--text-muted);
            padding: 4px 10px;
            border-radius: var(--radius-sm);
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
        }

        .chart-btn.active {
            background: rgba(56, 189, 248, 0.2);
            color: var(--accent-cyan);
            border-color: rgba(56, 189, 248, 0.4);
        }

        .canvas-wrapper {
            position: relative;
            flex: 1;
            width: 100%;
            min-height: 320px;
        }

        .secondary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
            gap: 1.5rem;
        }

        .budget-box {
            padding: clamp(1.15rem, 1.8vw, 1.6rem);
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .budget-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
            gap: 1.25rem;
            margin-top: 0.25rem;
        }

        .budget-card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 0.9rem;
            transition: all 0.2s ease;
        }

        .budget-card:hover {
            border-color: rgba(255, 255, 255, 0.12);
            background: rgba(255, 255, 255, 0.035);
        }

        .budget-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 0.4rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .budget-group-title {
            font-size: 0.95rem;
            font-weight: 700;
            color: var(--text-main);
            display: flex;
            align-items: center;
            gap: 7px;
        }

        .budget-sub-block {
            display: flex;
            flex-direction: column;
            gap: 0.45rem;
        }

        .budget-sub-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .budget-sub-title {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .budget-sub-divider {
            height: 1px;
            background: rgba(255, 255, 255, 0.04);
            margin: 0.15rem 0;
        }

        .budget-title {
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--text-main);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .budget-tag {
            font-size: 0.7rem;
            padding: 2px 8px;
            border-radius: 999px;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-muted);
        }

        .budget-values {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
        }

        .budget-cur {
            font-size: clamp(1.2rem, 1.6vw, 1.5rem);
            font-weight: 800;
            color: var(--text-main);
        }

        .budget-max {
            font-size: 0.8rem;
            color: var(--text-dim);
            font-weight: 500;
        }

        .budget-progress-track {
            width: 100%;
            height: 8px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 999px;
            overflow: hidden;
            position: relative;
        }

        .budget-progress-fill {
            height: 100%;
            border-radius: 999px;
            transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .budget-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.75rem;
            color: var(--text-dim);
        }

        .table-box {
            padding: 1.5rem;
            overflow: hidden;
        }

        .table-wrapper {
            overflow-x: auto;
            margin-top: 1rem;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: clamp(0.78rem, 0.9vw, 0.85rem);
        }

        th {
            padding: 12px 16px;
            background: rgba(0, 0, 0, 0.2);
            color: var(--text-muted);
            font-weight: 600;
            border-bottom: 1px solid var(--border-subtle);
            text-transform: uppercase;
            font-size: clamp(0.68rem, 0.8vw, 0.75rem);
            letter-spacing: 0.05em;
        }

        th.sortable {
            cursor: pointer;
            user-select: none;
            transition: all 0.2s ease;
        }

        th.sortable:hover {
            color: var(--accent-cyan);
            background: rgba(56, 189, 248, 0.08);
        }

        th .sort-icon {
            display: inline-block;
            margin-left: 5px;
            height: 20px;
            width: 20px;
            font-size: 0.75rem;
            color: var(--text-dim);
            transition: transform 0.15s ease, color 0.15s ease;
        }

        th:first-child,
        td:first-child {
            width: 300px;
            min-width: 300px;
            max-width: 300px;
        }

        th.col-code,
        td.col-code {
            width: 170px;
            min-width: 170px;
            white-space: nowrap;
        }

        td {
            padding: 12px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            color: var(--text-main);
        }

        tr:hover td {
            background: rgba(255, 255, 255, 0.02);
        }

        .breakdown-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 8px;
        }

        .breakdown-item {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .breakdown-header {
            display: flex;
            justify-content: space-between;
            font-size: 0.825rem;
        }

        .progress-bar-bg {
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.06);
            border-radius: 999px;
            overflow: hidden;
        }

        .progress-bar-fill {
            height: 100%;
            border-radius: 999px;
            background: linear-gradient(90deg, var(--accent-cyan), var(--accent-violet));
            transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        footer {
            margin-top: 3rem;
            padding: 1.5rem 2rem;
            border-top: 1px solid var(--border-subtle);
            text-align: center;
            color: var(--text-dim);
            font-size: 0.8rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
        }
    </style>
</head>
<body>
    <header>
        <div class="brand-container">
            <div class="brand-badge">
                ${logoDataUri ? `<img src="${logoDataUri}" alt="FluxFlow" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;" />` : '⚡'}
            </div>
            <div>
                <div class="brand-title">FluxFlow Analytics</div>
                <div class="brand-subtitle">Token Intelligence & Activity Monitor</div>
            </div>
        </div>
        <div class="header-actions">
            <button class="btn" id="btn-export-json" title="Export Token Usage as JSON">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export JSON
            </button>
            <button class="btn" id="btn-export-csv" title="Export Token Usage as CSV">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Export CSV
            </button>
            <button class="btn btn-primary" id="btn-refresh">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                Sync Now
            </button>
        </div>
    </header>

    <div class="container">
        <!-- Controls Bar -->
        <div class="glass-panel controls-bar">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">TIME RANGE:</span>
                <div class="tabs-group" id="range-tabs">
                    <button class="tab-btn" data-range="today">Today</button>
                    <button class="tab-btn active" data-range="7d">Last 7 Days</button>
                    <button class="tab-btn" data-range="14d">Last 14 Days</button>
                    <button class="tab-btn" data-range="30d">Last 30 Days</button>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <label style="font-size: 0.8rem; color: var(--text-dim); display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="checkbox" id="auto-refresh-check" style="accent-color: var(--accent-cyan);">
                    Auto-Sync (60s)
                </label>
                <span style="font-size: 0.75rem; color: var(--text-dim);" id="last-sync-time">Last synced: Just now</span>
            </div>
        </div>

        <!-- Metrics Cards -->
        <div class="metrics-grid">
            <div class="glass-panel metric-card" style="--card-accent: var(--accent-cyan);">
                <div class="metric-header">
                    <span class="metric-label">Total Tokens</span>
                    <div class="metric-icon">✦</div>
                </div>
                <div class="metric-value mono" id="m-total-tokens">0</div>
                <div class="metric-sub">
                    <span class="badge-info" id="m-tokens-detail">0 In / 0 Out</span>
                </div>
            </div>

            <div class="glass-panel metric-card" style="--card-accent: var(--accent-emerald);">
                <div class="metric-header">
                    <span class="metric-label">Cache Ratio</span>
                    <div class="metric-icon">⚡</div>
                </div>
                <div class="metric-value mono" id="m-cached-tokens">0%</div>
                <div class="metric-sub">
                    <span class="badge-positive" id="m-cached-saved">0 cached tokens</span>
                </div>
            </div>

            <div class="glass-panel metric-card" style="--card-accent: var(--accent-amber);">
                <div class="metric-header">
                    <span class="metric-label">API Calls</span>
                    <div class="metric-icon">⚙️</div>
                </div>
                <div class="metric-value mono" id="m-total-requests">0</div>
                <div class="metric-sub">
                    <span id="m-requests-sub">0 Agent / 0 Sub-agents</span>
                </div>
            </div>

            <div class="glass-panel metric-card" style="--card-accent: var(--accent-rose);">
                <div class="metric-header">
                    <span class="metric-label">Tool Reliability</span>
                    <div class="metric-icon">🛠️</div>
                </div>
                <div class="metric-value mono" id="m-tool-rate">100%</div>
                <div class="metric-sub">
                    <span id="m-tool-sub">0 ok / 0 err / 0 denied</span>
                </div>
            </div>

            <div class="glass-panel metric-card" style="--card-accent: var(--accent-blue);">
                <div class="metric-header">
                    <span class="metric-label">Code Impact</span>
                    <div class="metric-icon">📝</div>
                </div>
                <div class="metric-value mono" id="m-code-delta">+0 / -0</div>
                <div class="metric-sub">
                    <span id="m-code-net">Net: 0 lines</span>
                </div>
            </div>
        </div>

        <!-- Budget & Quota Tracking -->
        <div class="glass-panel budget-box" id="budget-section">
            <div class="chart-header">
                <div class="chart-title-group">
                    <div class="chart-title" style="display: flex; align-items: center; gap: 8px;">
                        <span>💰</span>
                        <span>Budget & Quota Tracking</span>
                        <span id="budget-tier-pill" style="display: none; font-size: 0.7rem; margin-left: 4px;"></span>
                    </div>
                    <div class="chart-subtitle" id="budget-subtitle">Real-time spend against configured daily and monthly token limits</div>
                </div>
                <div id="budget-reset-badge" style="font-size: 0.75rem; color: var(--text-muted); background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                    Reset Mode: Daily
                </div>
            </div>
            <div class="budget-grid" id="budget-grid-cards">
                <!-- Dynamically populated by JS -->
            </div>
        </div>

        <!-- Main Chart Row -->
        <div class="chart-row">
            <!-- Timeline Chart -->
            <div class="glass-panel chart-box">
                <div class="chart-header">
                    <div class="chart-title-group">
                        <div class="chart-title">Token Consumption Trends</div>
                        <div class="chart-subtitle">Prompt (Input), Candidate (Output), and Cached tokens breakdown</div>
                    </div>
                    <div class="chart-controls">
                        <button class="chart-btn active" data-chart-type="bar">Stacked Bar</button>
                        <button class="chart-btn" data-chart-type="line">Area Chart</button>
                    </div>
                </div>
                <div class="canvas-wrapper">
                    <canvas id="timelineChart"></canvas>
                </div>
            </div>

            <!-- Provider / Model Share -->
            <div class="glass-panel chart-box">
                <div class="chart-header">
                    <div class="chart-title-group">
                        <div class="chart-title">Token Share by Provider</div>
                        <div class="chart-subtitle">Distribution of tokens across Inference Providers</div>
                    </div>
                </div>
                <div class="canvas-wrapper" style="min-height: 240px;">
                    <canvas id="providerPieChart"></canvas>
                </div>
                <div class="breakdown-list" id="provider-breakdown-list"></div>
            </div>
        </div>

        <!-- Secondary Charts -->
        <div class="secondary-grid">
            <!-- Tool Execution Health -->
            <div class="glass-panel chart-box">
                <div class="chart-header">
                    <div class="chart-title-group">
                        <div class="chart-title">Tool Executions & Reliability</div>
                        <div class="chart-subtitle">Success, Error & Permission Denial breakdown</div>
                    </div>
                </div>
                <div class="canvas-wrapper">
                    <canvas id="toolChart"></canvas>
                </div>
            </div>

            <!-- Code Velocity -->
            <div class="glass-panel chart-box">
                <div class="chart-header">
                    <div class="chart-title-group">
                        <div class="chart-title">Code Modification Volume</div>
                        <div class="chart-subtitle">Lines of code written (+) vs deleted (-) by agents</div>
                    </div>
                </div>
                <div class="canvas-wrapper">
                    <canvas id="codeChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Detailed Breakdown Table -->
        <div class="glass-panel table-box">
            <div class="chart-header">
                <div class="chart-title-group">
                    <div class="chart-title" id="table-view-title">Daily Detailed Token Records</div>
                    <div class="chart-subtitle" id="table-view-subtitle">Itemized log of daily token counts, cache ratios, and tool operations</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <div class="tabs-group" id="table-mode-tabs">
                        <button class="tab-btn active" data-table-mode="daily">Daily Records</button>
                        <button class="tab-btn" data-table-mode="models">Model Stats</button>
                    </div>
                    <input type="text" id="table-search" placeholder="Search..." style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); color: var(--text-main); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.8rem; outline: none;">
                </div>
            </div>
            <div class="table-wrapper">
                <table id="usage-table">
                    <thead id="usage-table-head">
                        <!-- Populated by JS -->
                    </thead>
                    <tbody id="usage-table-body">
                        <!-- Populated by JS -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <footer>
        <div>FluxFlow CLI • High-Fidelity Agentic Terminal</div>
        <div>Data stored locally in ${DATA_DIR.replaceAll('\\\\', '/').replaceAll('\\', '/') }</div>
    </footer>

    <script>
        let rawData = null;
        let activeRange = '7d';
        let chartType = 'bar';
        let tableMode = 'daily';
        let dailySortField = 'date';
        let dailySortOrder = 'desc';
        let modelSortField = 'tokens';
        let modelSortOrder = 'desc';
        let timelineChart = null;
        let providerPieChart = null;
        let toolChart = null;
        let codeChart = null;

        function formatNumber(num) {
            if (num === undefined || num === null) return '0';
            if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
            if (num >= 1_000) return (num / 1_000).toFixed(1) + 'k';
            return num.toLocaleString();
        }

        function filterTimelineByRange(timeline, range) {
            if (!timeline || timeline.length === 0) return [];
            const todayStr = rawData.currentDate || new Date().toISOString().split('T')[0];
            const todayTime = new Date(todayStr).getTime();

            let days = 7;
            if (range === 'today') days = 1;
            else if (range === '7d') days = 7;
            else if (range === '14d') days = 14;
            else if (range === '30d') days = 30;
            else days = 30;

            const cutoff = todayTime - (days - 1) * 24 * 60 * 60 * 1000;
            return timeline.filter(item => {
                const itemTime = new Date(item.date).getTime();
                return itemTime >= cutoff;
            });
        }

        async function fetchData() {
            try {
                const res = await fetch('/api/usage');
                rawData = await res.json();
                renderDashboard();
                document.getElementById('last-sync-time').textContent = 'Last synced: ' + new Date().toLocaleTimeString();
            } catch (err) {
                console.error('Failed to sync usage data:', err);
            }
        }

        function renderDashboard() {
            if (!rawData || !rawData.timeline) return;

            const filtered = filterTimelineByRange(rawData.timeline, activeRange);

            let totalTokens = 0;
            let cachedTokens = 0;
            let candidateTokens = 0;
            let promptTokens = 0;
            let agentRequests = 0;
            let bgRequests = 0;
            let searchRequests = 0;
            let toolSuccess = 0;
            let toolFailure = 0;
            let toolDenied = 0;
            let linesAdded = 0;
            let linesRemoved = 0;

            const providerTokens = {};
            const modelTokens = {};

            filtered.forEach(item => {
                totalTokens += item.tokens || 0;
                cachedTokens += item.cachedTokens || 0;
                candidateTokens += item.candidateTokens || 0;
                promptTokens += item.promptTokens || 0;
                agentRequests += item.agent || 0;
                bgRequests += item.background || 0;
                searchRequests += item.search || 0;
                toolSuccess += item.toolSuccess || 0;
                toolFailure += item.toolFailure || 0;
                toolDenied += item.toolDenied || 0;
                linesAdded += item.linesAdded || 0;
                linesRemoved += item.linesRemoved || 0;

                const models = item.models || {};
                for (const prov in models) {
                    providerTokens[prov] = (providerTokens[prov] || 0);
                    for (const m in models[prov]) {
                        const mTok = models[prov][m]?.tokens || 0;
                        providerTokens[prov] += mTok;
                        modelTokens[m] = (modelTokens[m] || 0) + mTok;
                    }
                }
            });

            document.getElementById('m-total-tokens').textContent = formatNumber(totalTokens);
            document.getElementById('m-tokens-detail').textContent = \`\${formatNumber(promptTokens)} In / \${formatNumber(candidateTokens)} Out\`;

            const cachePercent = promptTokens > 0 ? ((cachedTokens / promptTokens) * 100).toFixed(1) : 0;
            document.getElementById('m-cached-tokens').textContent = cachePercent + '%';
            document.getElementById('m-cached-saved').textContent = \`\${formatNumber(cachedTokens)} / \${formatNumber(promptTokens)} Cached\`;

            const totalReq = agentRequests + bgRequests + searchRequests;
            document.getElementById('m-total-requests').textContent = totalReq.toLocaleString();
            document.getElementById('m-requests-sub').textContent = \`\${agentRequests} Agent / \${bgRequests} Background\`;

            const totalTools = toolSuccess + toolFailure + toolDenied;
            const toolRate = totalTools > 0 ? ((toolSuccess / totalTools) * 100).toFixed(1) : 100;
            document.getElementById('m-tool-rate').textContent = toolRate + '%';
            document.getElementById('m-tool-sub').textContent = \`\${toolSuccess} ok / \${toolFailure} err / \${toolDenied} denied\`;

            document.getElementById('m-code-delta').innerHTML = \`<span style="color: #38bdf8;">+\${formatNumber(linesAdded)}</span> <span style="color: #64748b; font-size: 0.85em;">/</span> <span style="color: #f43f5e;">-\${formatNumber(linesRemoved)}</span>\`;
            document.getElementById('m-code-net').textContent = \`Net: \${linesAdded - linesRemoved >= 0 ? '+' : ''}\${formatNumber(linesAdded - linesRemoved)} lines\`;

            if (rawData && rawData.budget) {
                renderBudget(rawData.budget);
            }

            renderTimelineChart(filtered);
            renderProviderChart(providerTokens, totalTokens);
            renderToolChart(filtered);
            renderCodeChart(filtered);
            renderTable(filtered);
        }

        function getProviderBrandIcon(providerName, size = 20) {
            const p = (providerName || '').toLowerCase().trim();
            if (p.includes('google') || p.includes('gemini')) {
                return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="gg-gemini" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#4285F4"/>
                            <stop offset="45%" stop-color="#9B72CB"/>
                            <stop offset="100%" stop-color="#EA4335"/>
                        </linearGradient>
                    </defs>
                    <path d="M12 1C12 7.075 7.075 12 1 12C7.075 12 12 16.925 12 23C12 16.925 16.925 12 23 12C16.925 12 12 7.075 12 1Z" fill="url(#gg-gemini)"/>
                </svg>\`;
            } else if (p.includes('nvidia')) {
                return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.85 7.15c.61-.17 1.43-.27 2.15-.27 3.32 0 6.01 2.37 6.01 5.3s-2.69 5.3-6.01 5.3c-.72 0-1.54-.1-2.15-.27V7.15zM2.5 12.18c0-3.32 2.3-6.17 5.75-6.9v13.8c-3.45-.73-5.75-3.58-5.75-6.9zm13.1 4.74c1.88-1.07 3.15-2.88 3.15-4.74 0-1.86-1.27-3.67-3.15-4.74l1.58-1.58C19.98 7.37 21.5 9.61 21.5 12.18s-1.52 4.81-4.32 6.32l-1.58-1.58z" fill="#76B900"/>
                </svg>\`;
            } else if (p.includes('deepseek')) {
                return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 3.82 2.15 7.14 5.3 8.84.18-.7.42-1.65.42-2.3 0-.82-.24-1.22-.52-1.74-.75-1.39-1.2-2.63-1.2-4.4 0-3.1 2.33-5.6 5.21-5.6 2.88 0 5.21 2.5 5.21 5.6 0 2.22-.73 4.14-2.11 5.42-.51.48-.96 1.05-.96 1.83 0 .7.26 1.58.42 2.24C17.65 20.25 22 16.63 22 12c0-5.52-4.48-10-10-10z" fill="#1D4ED8"/>
                    <circle cx="10" cy="11.5" r="1.4" fill="#60A5FA"/>
                    <circle cx="14" cy="11.5" r="1.4" fill="#60A5FA"/>
                </svg>\`;
            } else if (p.includes('mistral')) {
                return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="3" width="3.6" height="3.6" rx="0.5" fill="#FF7000"/>
                    <rect x="18.4" y="3" width="3.6" height="3.6" rx="0.5" fill="#FF7000"/>
                    <rect x="2" y="8.4" width="3.6" height="3.6" rx="0.5" fill="#FF7000"/>
                    <rect x="7.4" y="8.4" width="3.6" height="3.6" rx="0.5" fill="#FF7000"/>
                    <rect x="13" y="8.4" width="3.6" height="3.6" rx="0.5" fill="#FF7000"/>
                    <rect x="18.4" y="8.4" width="3.6" height="3.6" rx="0.5" fill="#FF7000"/>
                    <rect x="2" y="13.8" width="3.6" height="3.6" rx="0.5" fill="#FF7000"/>
                    <rect x="7.4" y="13.8" width="3.6" height="3.6" rx="0.5" fill="#FF7000"/>
                    <rect x="13" y="13.8" width="3.6" height="3.6" rx="0.5" fill="#FF7000"/>
                    <rect x="18.4" y="13.8" width="3.6" height="3.6" rx="0.5" fill="#FF7000"/>
                    <rect x="2" y="19.2" width="3.6" height="3.6" rx="0.5" fill="#FF7000"/>
                    <rect x="18.4" y="19.2" width="3.6" height="3.6" rx="0.5" fill="#FF7000"/>
                </svg>\`;
            } else if (p.includes('openrouter')) {
                return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="7" height="7" rx="2" fill="#6366F1"/>
                    <rect x="14" y="3" width="7" height="7" rx="2" fill="#38BDF8"/>
                    <rect x="3" y="14" width="7" height="7" rx="2" fill="#38BDF8"/>
                    <rect x="14" y="14" width="7" height="7" rx="2" fill="#6366F1"/>
                    <path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4" stroke="rgba(255,255,255,0.85)" stroke-width="1.6" stroke-linecap="round"/>
                </svg>\`;
            } else if (p.includes('ollama')) {
                return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 3h3v4.5h2V4h3v8.5c0 2.2-1.8 4-4 4h-1v4.5H9V16.5H8c-2.2 0-4-1.8-4-4V7c0-2.2 1.8-4 4-4z" fill="#F59E0B"/>
                    <circle cx="10" cy="5.8" r="1.1" fill="#1E293B"/>
                    <circle cx="14" cy="5.8" r="1.1" fill="#1E293B"/>
                </svg>\`;
            } else if (p.includes('inferx')) {
                return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="inf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#EC4899"/>
                            <stop offset="100%" stop-color="#8B5CF6"/>
                        </linearGradient>
                    </defs>
                    <path d="M4 4l6.5 7L4 20h3.5l4.5-5.2 4.5 5.2H20l-6.5-9L20 4h-3.5L12 9.2 7.5 4H4z" fill="url(#inf-grad)"/>
                </svg>\`;
            } else if (p.includes('sensenova') || p.includes('sense')) {
                return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="sense-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#06B6D4"/>
                            <stop offset="100%" stop-color="#6366F1"/>
                        </linearGradient>
                    </defs>
                    <circle cx="12" cy="12" r="8.5" stroke="url(#sense-grad)" stroke-width="2"/>
                    <path d="M12 5v14M5 12h14M7 7l10 10M17 7L7 17" stroke="url(#sense-grad)" stroke-width="1.5" stroke-linecap="round"/>
                    <circle cx="12" cy="12" r="2.8" fill="#06B6D4"/>
                </svg>\`;
            } else if (p.includes('crofai') || p.includes('crof')) {
                return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 8.5v7L12 22l10-6.5v-7L12 2z" stroke="#10B981" stroke-width="2" stroke-linejoin="round" fill="rgba(16,185,129,0.18)"/>
                    <path d="M12 2v20M2 8.5l10 4.5 10-4.5" stroke="#10B981" stroke-width="1.5"/>
                </svg>\`;
            } else if (p.includes('aihubmix') || p.includes('hubmix')) {
                return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="4.5" r="2.8" fill="#A855F7"/>
                    <circle cx="5" cy="18" r="2.8" fill="#D946EF"/>
                    <circle cx="19" cy="18" r="2.8" fill="#EC4899"/>
                    <path d="M12 7.5v6.5M12 14L6.8 16.8M12 14l5.2 2.8" stroke="#A855F7" stroke-width="1.8" stroke-linecap="round"/>
                </svg>\`;
            } else if (p.includes('anthropic') || p.includes('claude')) {
                return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14.5 3L8 21h3.5l1.3-3.8h4.4L18.5 21H22L15.5 3h-1zm.3 4.2l1.6 6.8h-3.2l1.6-6.8zM2 21h3.5L9.5 3H6L2 21z" fill="#D97757"/>
                </svg>\`;
            } else if (p.includes('openai')) {
                return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.5 10.3a5.5 5.5 0 0 0-.4-4.5 5.6 5.6 0 0 0-5.8-2.6A5.5 5.5 0 0 0 9.8 1.8a5.6 5.6 0 0 0-5.3 3.9 5.5 5.5 0 0 0-3.3 3.6 5.6 5.6 0 0 0 .9 6.2 5.5 5.5 0 0 0 .4 4.5 5.6 5.6 0 0 0 5.8 2.6 5.5 5.5 0 0 0 4.5 1.4 5.6 5.6 0 0 0 5.3-3.9 5.5 5.5 0 0 0 3.3-3.6 5.6 5.6 0 0 0-.9-6.2z" stroke="#10A37F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>\`;
            }
            return \`<span style="color: var(--accent-cyan); font-size: 1.1rem; vertical-align: middle;">✦</span>\`;
        }

        function renderBudget(budgetData) {
            const grid = document.getElementById('budget-grid-cards');
            const tierPill = document.getElementById('budget-tier-pill');
            const resetBadge = document.getElementById('budget-reset-badge');
            const subtitleEl = document.getElementById('budget-subtitle');

            if (!budgetData) {
                grid.innerHTML = '<div style="color: var(--text-dim); padding: 1rem;">No budget constraints configured.</div>';
                return;
            }

            const isProviderMode = budgetData.providerBudgetsList && budgetData.providerBudgetsList.length > 0;

            if (isProviderMode) {
                tierPill.style.display = 'inline-block';
                tierPill.className = 'badge-positive';
                tierPill.textContent = \`Provider Mode (\${budgetData.providerBudgetsList.length} Active)\`;
                subtitleEl.textContent = 'Enforcing provider-specific daily, monthly, and turn quotas';
            } else {
                tierPill.style.display = 'none';
                subtitleEl.textContent = 'Real-time spend against configured global daily and monthly token limits';
            }

            resetBadge.textContent = 'Reset: ' + (budgetData.resetMode || 'None') + (budgetData.resetMode === 'Custom' ? \` (Day \${budgetData.resetDay})\` : '');

            let cardsHtml = '';

            if (isProviderMode) {
                budgetData.providerBudgetsList.forEach(prov => {
                    const dailyTokens = prov.dailyTokens || 0;
                    const dailyLimit = prov.dailyTokenLimit || 0;
                    const isDailyUnlimited = prov.isDailyUnlimited;
                    const dailyPct = (!isDailyUnlimited && dailyLimit > 0) ? Math.min(100, (dailyTokens / dailyLimit) * 100) : 0;
                    const dailyColor = dailyPct >= 90 ? 'linear-gradient(90deg, #f43f5e, #e11d48)' : dailyPct >= 75 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #38bdf8, #0284c7)';

                    const monthlyTokens = prov.monthlyTokens || 0;
                    const monthlyLimit = prov.monthlyTokenLimit || 0;
                    const isMonthlyUnlimited = prov.isMonthlyUnlimited;
                    const monthlyPct = (!isMonthlyUnlimited && monthlyLimit > 0) ? Math.min(100, (monthlyTokens / monthlyLimit) * 100) : 0;
                    const monthlyColor = monthlyPct >= 90 ? 'linear-gradient(90deg, #f43f5e, #e11d48)' : monthlyPct >= 75 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #a855f7, #7c3aed)';

                    // Unified Provider Card grouping both Daily and Monthly
                    cardsHtml += \`
                        <div class="budget-card">
                            <div class="budget-card-header">
                                <div class="budget-group-title">
                                    \${getProviderBrandIcon(prov.provider, 22)}
                                    <span>\${prov.provider}</span>
                                </div>
                            </div>

                            <!-- Daily Budget Sub-Block -->
                            <div class="budget-sub-block">
                                <div class="budget-sub-header">
                                    <span class="budget-sub-title">⚡ Daily Token Budget</span>
                                    <span class="budget-tag" style="font-size: 0.68rem; padding: 1px 6px;">\${isDailyUnlimited ? 'Unlimited' : dailyPct.toFixed(1) + '%'}</span>
                                </div>
                                <div class="budget-values">
                                    <div class="budget-cur mono">\${formatNumber(dailyTokens)}</div>
                                    <div class="budget-max mono">/ \${isDailyUnlimited ? '∞ Limit' : formatNumber(dailyLimit)}</div>
                                </div>
                                <div class="budget-progress-track">
                                    <div class="budget-progress-fill" style="width: \${isDailyUnlimited ? 100 : dailyPct}%; background: \${isDailyUnlimited ? 'rgba(56,189,248,0.3)' : dailyColor};"></div>
                                </div>
                                <div class="budget-footer">
                                    <span>\${isDailyUnlimited ? 'No daily cap' : \`\${formatNumber(Math.max(0, dailyLimit - dailyTokens))} remaining\`}</span>
                                    <span class="mono">\${isDailyUnlimited ? 'Active' : \`\${dailyPct.toFixed(0)}% used\`}</span>
                                </div>
                            </div>

                            <div class="budget-sub-divider"></div>

                            <!-- Monthly Budget Sub-Block -->
                            <div class="budget-sub-block">
                                <div class="budget-sub-header">
                                    <span class="budget-sub-title">📅 Monthly / Cycle Budget</span>
                                    <span class="budget-tag" style="font-size: 0.68rem; padding: 1px 6px;">\${isMonthlyUnlimited ? 'Unlimited' : monthlyPct.toFixed(1) + '%'}</span>
                                </div>
                                <div class="budget-values">
                                    <div class="budget-cur mono">\${formatNumber(monthlyTokens)}</div>
                                    <div class="budget-max mono">/ \${isMonthlyUnlimited ? '∞ Limit' : formatNumber(monthlyLimit)}</div>
                                </div>
                                <div class="budget-progress-track">
                                    <div class="budget-progress-fill" style="width: \${isMonthlyUnlimited ? 100 : monthlyPct}%; background: \${isMonthlyUnlimited ? 'rgba(168,85,247,0.3)' : monthlyColor};"></div>
                                </div>
                                <div class="budget-footer">
                                    <span>\${isMonthlyUnlimited ? 'No monthly cap' : \`\${formatNumber(Math.max(0, monthlyLimit - monthlyTokens))} remaining\`}</span>
                                    <span class="mono">\${isMonthlyUnlimited ? 'Active' : \`\${monthlyPct.toFixed(0)}% used\`}</span>
                                </div>
                            </div>
                        </div>
                    \`;
                });
            } else {
                // Global Mode Cards
                const daily = budgetData.daily || {};
                const monthly = budgetData.monthly || {};

                const dailyTokens = daily.tokensUsed || 0;
                const dailyLimit = daily.tokenLimit || 0;
                const isDailyUnlimited = daily.isUnlimitedTokens;
                const dailyPct = (!isDailyUnlimited && dailyLimit > 0) ? Math.min(100, (dailyTokens / dailyLimit) * 100) : 0;
                const dailyColor = dailyPct >= 90 ? 'linear-gradient(90deg, #f43f5e, #e11d48)' : dailyPct >= 75 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #38bdf8, #0284c7)';

                const monthlyTokens = monthly.tokensUsed || 0;
                const monthlyLimit = monthly.tokenLimit || 0;
                const isMonthlyUnlimited = monthly.isUnlimitedTokens;
                const monthlyPct = (!isMonthlyUnlimited && monthlyLimit > 0) ? Math.min(100, (monthlyTokens / monthlyLimit) * 100) : 0;
                const monthlyColor = monthlyPct >= 90 ? 'linear-gradient(90deg, #f43f5e, #e11d48)' : monthlyPct >= 75 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #a855f7, #7c3aed)';

                cardsHtml += \`
                    <div class="budget-card">
                        <div class="budget-card-header">
                            <div class="budget-group-title">
                                <span style="color: var(--accent-cyan);">⚡</span>
                                <span>Global Budget Quotas</span>
                            </div>
                            <span class="budget-tag">Global Cap</span>
                        </div>

                        <!-- Daily Budget Sub-Block -->
                        <div class="budget-sub-block">
                            <div class="budget-sub-header">
                                <span class="budget-sub-title">⚡ Daily Token Budget</span>
                                <span class="budget-tag" style="font-size: 0.68rem; padding: 1px 6px;">\${isDailyUnlimited ? 'Unlimited' : dailyPct.toFixed(1) + '%'}</span>
                            </div>
                            <div class="budget-values">
                                <div class="budget-cur mono">\${formatNumber(dailyTokens)}</div>
                                <div class="budget-max mono">/ \${isDailyUnlimited ? '∞ Limit' : formatNumber(dailyLimit)}</div>
                            </div>
                            <div class="budget-progress-track">
                                <div class="budget-progress-fill" style="width: \${isDailyUnlimited ? 100 : dailyPct}%; background: \${isDailyUnlimited ? 'rgba(56,189,248,0.3)' : dailyColor};"></div>
                            </div>
                            <div class="budget-footer">
                                <span>\${isDailyUnlimited ? 'No daily cap enforced' : \`\${formatNumber(Math.max(0, dailyLimit - dailyTokens))} remaining\`}</span>
                                <span class="mono">\${isDailyUnlimited ? 'Active' : \`\${dailyPct.toFixed(0)}% used\`}</span>
                            </div>
                        </div>

                        <div class="budget-sub-divider"></div>

                        <!-- Monthly Budget Sub-Block -->
                        <div class="budget-sub-block">
                            <div class="budget-sub-header">
                                <span class="budget-sub-title">📅 Monthly / Cycle Budget</span>
                                <span class="budget-tag" style="font-size: 0.68rem; padding: 1px 6px;">\${isMonthlyUnlimited ? 'Unlimited' : monthlyPct.toFixed(1) + '%'}</span>
                            </div>
                            <div class="budget-values">
                                <div class="budget-cur mono">\${formatNumber(monthlyTokens)}</div>
                                <div class="budget-max mono">/ \${isMonthlyUnlimited ? '∞ Limit' : formatNumber(monthlyLimit)}</div>
                            </div>
                            <div class="budget-progress-track">
                                <div class="budget-progress-fill" style="width: \${isMonthlyUnlimited ? 100 : monthlyPct}%; background: \${isMonthlyUnlimited ? 'rgba(168,85,247,0.3)' : monthlyColor};"></div>
                            </div>
                            <div class="budget-footer">
                                <span>\${isMonthlyUnlimited ? 'No monthly cap enforced' : \`\${formatNumber(Math.max(0, monthlyLimit - monthlyTokens))} remaining\`}</span>
                                <span class="mono">\${isMonthlyUnlimited ? 'Active' : \`\${monthlyPct.toFixed(0)}% used\`}</span>
                            </div>
                        </div>
                    </div>
                \`;
            }

            grid.innerHTML = cardsHtml;
        }

        function renderTimelineChart(timeline) {
            const ctx = document.getElementById('timelineChart').getContext('2d');
            const labels = timeline.map(t => {
                const parts = t.date.split('-');
                return parts.length === 3 ? parts[1] + '/' + parts[2] : t.date;
            });

            const uncachedPromptData = timeline.map(t => t.uncachedPromptTokens !== undefined ? t.uncachedPromptTokens : Math.max(0, (t.promptTokens || 0) - (t.cachedTokens || 0)));
            const cachedData = timeline.map(t => t.cachedTokens || 0);
            const candidateData = timeline.map(t => t.candidateTokens || 0);

            if (timelineChart) timelineChart.destroy();

            const isLine = chartType === 'line';

            timelineChart = new Chart(ctx, {
                type: isLine ? 'line' : 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Input (Cached)',
                            data: cachedData,
                            backgroundColor: isLine ? 'rgba(4, 120, 87, 0.4)' : '#047857',
                            borderColor: '#047857',
                            borderWidth: isLine ? 2 : 0,
                            fill: isLine,
                            stack: 'tokens',
                            tension: 0.3
                        },
                        {
                            label: 'Input (Uncached)',
                            data: uncachedPromptData,
                            backgroundColor: isLine ? 'rgba(16, 185, 129, 0.65)' : '#10b981',
                            borderColor: '#10b981',
                            borderWidth: isLine ? 2 : 0,
                            fill: isLine,
                            stack: 'tokens',
                            tension: 0.3
                        },
                        {
                            label: 'Output (Candidate)',
                            data: candidateData,
                            backgroundColor: isLine ? 'rgba(168, 85, 247, 0.65)' : '#a855f7',
                            borderColor: '#a855f7',
                            borderWidth: isLine ? 2 : 0,
                            fill: isLine,
                            stack: 'tokens',
                            tension: 0.3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: '#94a3b8', boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' } }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#f8fafc',
                            bodyColor: '#e2e8f0',
                            borderColor: 'rgba(255, 255, 255, 0.12)',
                            borderWidth: 1,
                            padding: 10,
                            boxPadding: 4,
                            callbacks: {
                                labelColor: function(context) {
                                    const c = context.dataset.borderColor || context.dataset.backgroundColor;
                                    return {
                                        borderColor: c,
                                        backgroundColor: c
                                    };
                                },
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.y.toLocaleString() + ' tokens';
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#64748b' }
                        },
                        y: {
                            stacked: true,
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: {
                                color: '#64748b',
                                callback: val => formatNumber(val)
                            }
                        }
                    }
                }
            });
        }

        function renderProviderChart(providerTokens, totalTokens) {
            const ctx = document.getElementById('providerPieChart').getContext('2d');
            const listEl = document.getElementById('provider-breakdown-list');

            const providers = Object.keys(providerTokens);
            const dataVals = providers.map(p => providerTokens[p]);

            if (providerPieChart) providerPieChart.destroy();

            const colors = ['#38bdf8', '#a855f7', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6', '#06b6d4'];

            if (providers.length === 0) {
                listEl.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; text-align: center; padding: 1rem;">No multi-provider usage recorded yet.</div>';
                return;
            }

            providerPieChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: providers,
                    datasets: [{
                        data: dataVals,
                        backgroundColor: colors.slice(0, providers.length),
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: { display: false }
                    }
                }
            });

            listEl.innerHTML = providers.map((p, idx) => {
                const count = providerTokens[p];
                const pct = totalTokens > 0 ? ((count / totalTokens) * 100).toFixed(1) : 0;
                const col = colors[idx % colors.length];
                return \`
                    <div class="breakdown-item">
                        <div class="breakdown-header">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                \${getProviderBrandIcon(p, 16)}
                                <strong style="color: var(--text-main);">\${p}</strong>
                            </span>
                            <span class="mono" style="color: var(--text-muted);">\${formatNumber(count)} tokens (\${pct}%)</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: \${pct}%; background: \${col};"></div>
                        </div>
                    </div>
                \`;
            }).join('');
        }

        function renderToolChart(timeline) {
            const ctx = document.getElementById('toolChart').getContext('2d');
            const labels = timeline.map(t => t.date.split('-').slice(1).join('/'));

            if (toolChart) toolChart.destroy();

            toolChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Success',
                            data: timeline.map(t => t.toolSuccess || 0),
                            backgroundColor: 'rgba(16, 185, 129, 0.75)',
                            borderRadius: 4
                        },
                        {
                            label: 'Failed',
                            data: timeline.map(t => t.toolFailure || 0),
                            backgroundColor: 'rgba(244, 63, 94, 0.75)',
                            borderRadius: 4
                        },
                        {
                            label: 'Denied',
                            data: timeline.map(t => t.toolDenied || 0),
                            backgroundColor: 'rgba(245, 158, 11, 0.75)',
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { stacked: true, grid: { display: false } },
                        y: { stacked: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
                    },
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }

        function renderCodeChart(timeline) {
            const ctx = document.getElementById('codeChart').getContext('2d');
            const labels = timeline.map(t => t.date.split('-').slice(1).join('/'));

            if (codeChart) codeChart.destroy();

            codeChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Lines Added (+)',
                            data: timeline.map(t => t.linesAdded || 0),
                            backgroundColor: 'rgba(56, 189, 248, 0.85)',
                            borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                            stack: 'codeStack'
                        },
                        {
                            label: 'Lines Removed (-)',
                            data: timeline.map(t => -(t.linesRemoved || 0)),
                            backgroundColor: 'rgba(244, 63, 94, 0.85)',
                            borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
                            stack: 'codeStack'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            grid: { display: false },
                            ticks: { color: '#64748b' }
                        },
                        y: {
                            stacked: true,
                            grid: {
                                color: function(context) {
                                    if (context.tick && context.tick.value === 0) {
                                        return 'rgba(255, 255, 255, 0.25)';
                                    }
                                    return 'rgba(255, 255, 255, 0.05)';
                                }
                            },
                            ticks: {
                                color: '#64748b',
                                callback: function(val) {
                                    const abs = Math.abs(val);
                                    if (abs === 0) return '0';
                                    return (val > 0 ? '+' : '-') + formatNumber(abs);
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#94a3b8', boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const val = context.raw;
                                    const abs = Math.abs(val);
                                    return (context.dataset.label || '') + ': ' + (val >= 0 ? '+' : '-') + abs.toLocaleString() + ' lines';
                                }
                            }
                        }
                    }
                }
            });
        }

        function getSortIndicator(field, currentField, currentOrder) {
            if (field !== currentField) {
                return '<span class="sort-icon" style="opacity: 0.35;">⇅</span>';
            }
            return currentOrder === 'asc'
                ? '<span class="sort-icon" style="color: var(--accent-cyan); opacity: 1; font-weight: bold;">↑</span>'
                : '<span class="sort-icon" style="color: var(--accent-cyan); opacity: 1; font-weight: bold;">↓</span>';
        }

        window.handleSort = function(field) {
            if (tableMode === 'daily') {
                if (dailySortField === field) {
                    dailySortOrder = dailySortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    dailySortField = field;
                    dailySortOrder = (field === 'date') ? 'desc' : 'desc';
                }
            } else {
                if (modelSortField === field) {
                    modelSortOrder = modelSortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    modelSortField = field;
                    modelSortOrder = (field === 'model' || field === 'provider') ? 'asc' : 'desc';
                }
            }
            if (rawData && rawData.timeline) {
                renderTable(filterTimelineByRange(rawData.timeline, activeRange));
            }
        };

        function renderTable(timeline) {
            const thead = document.getElementById('usage-table-head');
            const tbody = document.getElementById('usage-table-body');
            const titleEl = document.getElementById('table-view-title');
            const subtitleEl = document.getElementById('table-view-subtitle');
            const searchInput = document.getElementById('table-search');
            const filterText = (searchInput.value || '').toLowerCase();

            if (tableMode === 'daily') {
                titleEl.textContent = 'Daily Detailed Token Records';
                subtitleEl.textContent = 'Itemized log of daily token counts, cache ratios, and tool operations (click headers to sort)';
                searchInput.placeholder = 'Filter by date...';

                thead.innerHTML = \`
                    <tr>
                        <th class="sortable" onclick="handleSort('date')">Date \${getSortIndicator('date', dailySortField, dailySortOrder)}</th>
                        <th class="sortable" onclick="handleSort('tokens')">Total Tokens \${getSortIndicator('tokens', dailySortField, dailySortOrder)}</th>
                        <th class="sortable" onclick="handleSort('promptTokens')">Prompt (In) \${getSortIndicator('promptTokens', dailySortField, dailySortOrder)}</th>
                        <th class="sortable" onclick="handleSort('candidateTokens')">Candidate (Out) \${getSortIndicator('candidateTokens', dailySortField, dailySortOrder)}</th>
                        <th class="sortable" onclick="handleSort('cachedTokens')">Cached Tokens \${getSortIndicator('cachedTokens', dailySortField, dailySortOrder)}</th>
                        <th class="sortable" onclick="handleSort('cachePct')">Cache % \${getSortIndicator('cachePct', dailySortField, dailySortOrder)}</th>
                        <th class="sortable" onclick="handleSort('requests')">Requests \${getSortIndicator('requests', dailySortField, dailySortOrder)}</th>
                        <th class="sortable" onclick="handleSort('toolSuccessRate')">Tool Success \${getSortIndicator('toolSuccessRate', dailySortField, dailySortOrder)}</th>
                        <th class="sortable col-code" onclick="handleSort('linesAdded')">Code Lines \${getSortIndicator('linesAdded', dailySortField, dailySortOrder)}</th>
                    </tr>
                \`;

                let rows = [...timeline].filter(item => {
                    return !filterText || item.date.toLowerCase().includes(filterText);
                });

                rows.sort((a, b) => {
                    let valA, valB;
                    if (dailySortField === 'date') {
                        valA = new Date(a.date).getTime();
                        valB = new Date(b.date).getTime();
                    } else if (dailySortField === 'requests') {
                        valA = a.totalRequests || 0;
                        valB = b.totalRequests || 0;
                    } else if (dailySortField === 'cachePct') {
                        valA = (a.promptTokens || 0) > 0 ? ((a.cachedTokens || 0) / (a.promptTokens || 1)) : 0;
                        valB = (b.promptTokens || 0) > 0 ? ((b.cachedTokens || 0) / (b.promptTokens || 1)) : 0;
                    } else if (dailySortField === 'linesAdded') {
                        valA = (a.linesAdded || 0) - (a.linesRemoved || 0);
                        valB = (b.linesAdded || 0) - (b.linesRemoved || 0);
                    } else {
                        valA = a[dailySortField] || 0;
                        valB = b[dailySortField] || 0;
                    }
                    return dailySortOrder === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
                });

                if (rows.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-dim); padding: 2rem;">No matching daily token records found.</td></tr>';
                    return;
                }

                tbody.innerHTML = rows.map(item => {
                    const total = item.tokens || 0;
                    const cached = item.cachedTokens || 0;
                    const prompt = item.promptTokens || 0;
                    const cand = item.candidateTokens || 0;
                    const cachePct = prompt > 0 ? ((cached / prompt) * 100).toFixed(1) : '0.0';

                    return \`
                        <tr>
                            <td class="mono" style="font-weight: 600; color: var(--accent-cyan);">\${item.date}</td>
                            <td class="mono" style="font-weight: 700;">\${formatNumber(total)}</td>
                            <td class="mono" style="color: var(--accent-emerald);">\${formatNumber(prompt)}</td>
                            <td class="mono" style="color: var(--accent-violet);">\${formatNumber(cand)}</td>
                            <td class="mono" style="color: #059669;">\${formatNumber(cached)}</td>
                            <td>
                                <span class="badge-positive" style="font-size: 0.75rem;">\${cachePct}%</span>
                            </td>
                            <td>\${item.totalRequests || 0} req</td>
                            <td>
                                <span class="badge-info" style="font-size: 0.75rem;">\${item.toolSuccessRate}%</span>
                            </td>
                            <td class="mono col-code">
                                <span style="color: #38bdf8;">+\${formatNumber(item.linesAdded)}</span> /
                                <span style="color: #f43f5e;">-\${formatNumber(item.linesRemoved)}</span>
                            </td>
                        </tr>
                    \`;
                }).join('');
            } else {
                titleEl.textContent = 'Model Token Statistics';
                subtitleEl.textContent = 'Aggregated token distribution, cache performance and share per model (click headers to sort)';
                searchInput.placeholder = 'Filter by model or provider...';

                thead.innerHTML = \`
                    <tr>
                        <th class="sortable" onclick="handleSort('model')">Model Name \${getSortIndicator('model', modelSortField, modelSortOrder)}</th>
                        <th class="sortable" onclick="handleSort('provider')">Provider \${getSortIndicator('provider', modelSortField, modelSortOrder)}</th>
                        <th class="sortable" onclick="handleSort('tokens')">Total Tokens \${getSortIndicator('tokens', modelSortField, modelSortOrder)}</th>
                        <th class="sortable" onclick="handleSort('promptTokens')">Prompt (In) \${getSortIndicator('promptTokens', modelSortField, modelSortOrder)}</th>
                        <th class="sortable" onclick="handleSort('candidateTokens')">Candidate (Out) \${getSortIndicator('candidateTokens', modelSortField, modelSortOrder)}</th>
                        <th class="sortable" onclick="handleSort('cachedTokens')">Cached Tokens \${getSortIndicator('cachedTokens', modelSortField, modelSortOrder)}</th>
                        <th class="sortable" onclick="handleSort('cachePct')">Cache % \${getSortIndicator('cachePct', modelSortField, modelSortOrder)}</th>
                        <th class="sortable" onclick="handleSort('sharePct')">Token Share \${getSortIndicator('sharePct', modelSortField, modelSortOrder)}</th>
                    </tr>
                \`;

                const modelMap = {};
                let aggregateTokens = 0;

                timeline.forEach(day => {
                    const models = day.models || {};
                    for (const prov in models) {
                        for (const m in models[prov]) {
                            const entry = models[prov][m] || {};
                            const key = prov + '___' + m;
                            if (!modelMap[key]) {
                                modelMap[key] = {
                                    model: m,
                                    provider: prov,
                                    tokens: 0,
                                    promptTokens: 0,
                                    candidateTokens: 0,
                                    cachedTokens: 0
                                };
                            }
                            const tTok = entry.tokens || 0;
                            const tCand = entry.candidateTokens || 0;
                            const tPrompt = (entry.promptTokens !== undefined && entry.promptTokens !== null)
                                ? entry.promptTokens
                                : Math.max(0, tTok - tCand);
                            const tCache = entry.cachedTokens || 0;

                            modelMap[key].tokens += tTok;
                            modelMap[key].promptTokens += tPrompt;
                            modelMap[key].candidateTokens += tCand;
                            modelMap[key].cachedTokens += tCache;
                            aggregateTokens += tTok;
                        }
                    }
                });

                let modelList = Object.values(modelMap).map(item => {
                    const cachePct = item.promptTokens > 0
                        ? ((item.cachedTokens / item.promptTokens) * 100).toFixed(1)
                        : (item.tokens > 0 ? ((item.cachedTokens / item.tokens) * 100).toFixed(1) : '0.0');
                    const sharePct = aggregateTokens > 0 ? ((item.tokens / aggregateTokens) * 100).toFixed(1) : '0.0';
                    return {
                        ...item,
                        cachePct: parseFloat(cachePct),
                        sharePct: parseFloat(sharePct)
                    };
                });

                modelList.sort((a, b) => {
                    let valA = a[modelSortField];
                    let valB = b[modelSortField];
                    if (modelSortField === 'model' || modelSortField === 'provider') {
                        valA = (valA || '').toLowerCase();
                        valB = (valB || '').toLowerCase();
                        return modelSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    } else {
                        valA = valA || 0;
                        valB = valB || 0;
                        return modelSortOrder === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
                    }
                });

                if (filterText) {
                    modelList = modelList.filter(m => {
                        return m.model.toLowerCase().includes(filterText) || m.provider.toLowerCase().includes(filterText);
                    });
                }

                if (modelList.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 2rem;">No matching models found.</td></tr>';
                    return;
                }

                tbody.innerHTML = modelList.map(m => {
                    return \`
                        <tr>
                            <td class="mono" style="font-weight: 600; color: var(--text-main);">
                                <span style="display: inline-flex; align-items: center; gap: 8px;">
                                    \${getProviderBrandIcon(m.provider, 16)}
                                    <span>\${m.model}</span>
                                </span>
                            </td>
                            <td>
                                <span class="badge-info" style="font-size: 0.75rem; display: inline-flex; align-items: center; gap: 5px;">
                                    \${m.provider}
                                </span>
                            </td>
                            <td class="mono" style="font-weight: 700; color: var(--text-main);">\${formatNumber(m.tokens)}</td>
                            <td class="mono" style="color: var(--accent-emerald);">\${formatNumber(m.promptTokens)}</td>
                            <td class="mono" style="color: var(--accent-violet);">\${formatNumber(m.candidateTokens)}</td>
                            <td class="mono" style="color: #059669;">\${formatNumber(m.cachedTokens)}</td>
                            <td>
                                <span class="badge-positive" style="font-size: 0.75rem;">\${m.cachePct}%</span>
                            </td>
                            <td>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="flex: 1; min-width: 60px; height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden;">
                                        <div style="width: \${m.sharePct}%; height: 100%; background: linear-gradient(90deg, #38bdf8, #a855f7); border-radius: 999px;"></div>
                                    </div>
                                    <span class="mono" style="font-size: 0.75rem; color: var(--text-muted); min-width: 38px;">\${m.sharePct}%</span>
                                </div>
                            </td>
                        </tr>
                    \`;
                }).join('');
            }
        }

        function exportJson() {
            if (!rawData) return;
            const blob = new Blob([JSON.stringify(rawData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`fluxflow-token-usage-\${new Date().toISOString().split('T')[0]}.json\`;
            a.click();
            URL.revokeObjectURL(url);
        }

        function exportCsv() {
            if (!rawData || !rawData.timeline) return;
            const headers = ['Date', 'TotalTokens', 'PromptTokens', 'CandidateTokens', 'CachedTokens', 'CachePercent', 'AgentRequests', 'BackgroundRequests', 'SearchRequests', 'ToolSuccess', 'ToolFailure', 'ToolDenied', 'LinesAdded', 'LinesRemoved'];
            const csvRows = [headers.join(',')];

            rawData.timeline.forEach(t => {
                const total = t.tokens || 0;
                const cached = t.cachedTokens || 0;
                const cachePct = total > 0 ? ((cached / total) * 100).toFixed(1) : '0.0';
                const row = [
                    t.date,
                    total,
                    t.promptTokens || 0,
                    t.candidateTokens || 0,
                    cached,
                    cachePct,
                    t.agent || 0,
                    t.background || 0,
                    t.search || 0,
                    t.toolSuccess || 0,
                    t.toolFailure || 0,
                    t.toolDenied || 0,
                    t.linesAdded || 0,
                    t.linesRemoved || 0
                ];
                csvRows.push(row.join(','));
            });

            const blob = new Blob([csvRows.join('\\n')], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`fluxflow-token-usage-\${new Date().toISOString().split('T')[0]}.csv\`;
            a.click();
            URL.revokeObjectURL(url);
        }

        document.querySelectorAll('#range-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#range-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeRange = btn.dataset.range;
                renderDashboard();
            });
        });

        document.querySelectorAll('#table-mode-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#table-mode-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                tableMode = btn.dataset.tableMode;
                if (rawData && rawData.timeline) {
                    renderTable(filterTimelineByRange(rawData.timeline, activeRange));
                }
            });
        });

        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                chartType = btn.dataset.chartType;
                if (rawData && rawData.timeline) {
                    renderTimelineChart(filterTimelineByRange(rawData.timeline, activeRange));
                }
            });
        });

        document.getElementById('btn-refresh').addEventListener('click', fetchData);
        document.getElementById('btn-export-json').addEventListener('click', exportJson);
        document.getElementById('btn-export-csv').addEventListener('click', exportCsv);
        document.getElementById('table-search').addEventListener('input', () => {
            if (rawData && rawData.timeline) {
                renderTable(filterTimelineByRange(rawData.timeline, activeRange));
            }
        });

        setInterval(() => {
            if (document.getElementById('auto-refresh-check').checked) {
                fetchData();
            }
        }, 60000);

        fetchData();
    </script>
</body>
</html>`;
}

/**
 * Starts the HTTP server if not already running.
 */
export async function startUsageServer(preferredPort = 52140) {
    if (activeServer && activePort) {
        return { port: activePort, url: `http://localhost:${activePort}`, isNew: false };
    }

    const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

        if (url.pathname === '/api/usage') {
            try {
                const data = await getAllUsageData();
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(data));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
            return;
        }

        if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/usage') {
            const html = generateDashboardHtml();
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    });

    const listenOnAvailablePort = (startPort) => {
        return new Promise((resolve, reject) => {
            const tryPort = (port) => {
                server.once('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        tryPort(port + 1);
                    } else {
                        reject(err);
                    }
                });

                server.listen(port, '127.0.0.1', () => {
                    activeServer = server;
                    activePort = port;
                    resolve(port);
                });
            };
            tryPort(startPort);
        });
    };

    const port = await listenOnAvailablePort(preferredPort);
    const serverUrl = `http://localhost:${port}`;

    return { port, url: serverUrl, isNew: true };
}

/**
 * Opens the usage dashboard in the default browser.
 */
export async function openUsageDashboard(port = 52140) {
    const { url, isNew } = await startUsageServer(port);

    const platform = process.platform;
    const command = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';

    try {
        exec(`${command} ${url}`);
    } catch (e) { }

    return { url, port: activePort, isNew };
}
