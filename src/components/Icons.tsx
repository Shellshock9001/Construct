"use client";

/* ═══════════════════════════════════════════════════════════════════
   Construct — Professional SVG Icon Library
   
   Clean, crispy inline SVGs — no emoji, no external dependencies.
   Every icon is a React component returning a consistent 16x16 SVG.
   Stroke-based design matching VS Code / Cursor / Claude aesthetic.
   ═══════════════════════════════════════════════════════════════════ */

import React from "react";

interface IconProps {
    size?: number;
    color?: string;
    className?: string;
    strokeWidth?: number;
}

const defaults = { size: 16, color: "currentColor", strokeWidth: 1.8 };

function svg(props: IconProps, children: React.ReactNode) {
    const s = props.size ?? defaults.size;
    return (
        <svg
            width={s}
            height={s}
            viewBox="0 0 24 24"
            fill="none"
            stroke={props.color ?? defaults.color}
            strokeWidth={props.strokeWidth ?? defaults.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
            style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
        >
            {children}
        </svg>
    );
}

/* ─── Navigation & Layout ─── */

export function IconActivity(p: IconProps = {}) {
    return svg(p, <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>);
}

export function IconTerminal(p: IconProps = {}) {
    return svg(p, <><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></>);
}

export function IconFolder(p: IconProps = {}) {
    return svg(p, <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></>);
}

export function IconCpu(p: IconProps = {}) {
    return svg(p, <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
        <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
        <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </>);
}

export function IconBrain(p: IconProps = {}) {
    return svg(p, <>
        <path d="M12 2a6 6 0 0 0-6 6c0 1.6.6 3 1.6 4.1L12 22l4.4-9.9A6 6 0 0 0 18 8a6 6 0 0 0-6-6z" />
        <path d="M12 2a6 6 0 0 1 4 1.5A4 4 0 0 1 18 8" strokeOpacity="0.5" />
        <circle cx="12" cy="9" r="2" />
    </>);
}

/* ─── Agent & Status ─── */

export function IconBot(p: IconProps = {}) {
    return svg(p, <>
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="8.5" cy="16" r="1.5" fill={p.color ?? defaults.color} stroke="none" />
        <circle cx="15.5" cy="16" r="1.5" fill={p.color ?? defaults.color} stroke="none" />
        <path d="M12 2v4" /><circle cx="12" cy="2" r="1" />
        <path d="M3 15h-2" /><path d="M23 15h-2" />
    </>);
}

export function IconUsers(p: IconProps = {}) {
    return svg(p, <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>);
}

export function IconShield(p: IconProps = {}) {
    return svg(p, <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>);
}

export function IconShieldCheck(p: IconProps = {}) {
    return svg(p, <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
    </>);
}

/* ─── Actions ─── */

export function IconWrench(p: IconProps = {}) {
    return svg(p, <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>);
}

export function IconSearch(p: IconProps = {}) {
    return svg(p, <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>);
}

export function IconFileText(p: IconProps = {}) {
    return svg(p, <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </>);
}

export function IconEdit(p: IconProps = {}) {
    return svg(p, <>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </>);
}

/* ─── Communication ─── */

export function IconMessageSquare(p: IconProps = {}) {
    return svg(p, <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>);
}

export function IconLightbulb(p: IconProps = {}) {
    return svg(p, <>
        <path d="M9 18h6" /><path d="M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
    </>);
}

/* ─── Status ─── */

export function IconCheck(p: IconProps = {}) {
    return svg(p, <><polyline points="20 6 9 17 4 12" /></>);
}

export function IconCheckCircle(p: IconProps = {}) {
    return svg(p, <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>);
}

export function IconX(p: IconProps = {}) {
    return svg(p, <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
}

export function IconXCircle(p: IconProps = {}) {
    return svg(p, <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>);
}

export function IconAlertTriangle(p: IconProps = {}) {
    return svg(p, <>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </>);
}

export function IconAlertCircle(p: IconProps = {}) {
    return svg(p, <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>);
}

/* ─── Data & Analytics ─── */

export function IconBarChart(p: IconProps = {}) {
    return svg(p, <>
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
    </>);
}

export function IconHash(p: IconProps = {}) {
    return svg(p, <>
        <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
        <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </>);
}

export function IconClipboard(p: IconProps = {}) {
    return svg(p, <>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" />
    </>);
}

export function IconTarget(p: IconProps = {}) {
    return svg(p, <>
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </>);
}

/* ─── Misc ─── */

export function IconSettings(p: IconProps = {}) {
    return svg(p, <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>);
}

export function IconZap(p: IconProps = {}) {
    return svg(p, <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></>);
}

export function IconPlay(p: IconProps = {}) {
    return svg(p, <><polygon points="5 3 19 12 5 21 5 3" /></>);
}

export function IconPause(p: IconProps = {}) {
    return svg(p, <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>);
}

export function IconPlus(p: IconProps = {}) {
    return svg(p, <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>);
}

export function IconRefreshCw(p: IconProps = {}) {
    return svg(p, <>
        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>);
}

export function IconClock(p: IconProps = {}) {
    return svg(p, <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>);
}

export function IconDollarSign(p: IconProps = {}) {
    return svg(p, <>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>);
}

export function IconDatabase(p: IconProps = {}) {
    return svg(p, <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </>);
}

export function IconGitBranch(p: IconProps = {}) {
    return svg(p, <>
        <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
    </>);
}

export function IconFile(p: IconProps = {}) {
    return svg(p, <>
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <polyline points="13 2 13 9 20 9" />
    </>);
}

export function IconLink(p: IconProps = {}) {
    return svg(p, <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>);
}
