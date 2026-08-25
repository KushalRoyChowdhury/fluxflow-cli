import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*'
})

turndownService.use(gfm)

// Ignore elements marked with data-no-copy or hidden elements
turndownService.addRule('ignoreHidden', {
    filter: (node) => {
        return (
            node.hasAttribute('data-no-copy') ||
            (node.classList &&
                node.classList.contains('select-none') &&
                node.classList.contains('text-transparent'))
        )
    },
    replacement: () => ''
})

export default function CopyAsMarkdown() {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        const proseElement = document.querySelector('.prose')
        if (!proseElement) return

        try {
            const markdown = turndownService.turndown(proseElement)

            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(markdown)
            } else {
                const textarea = document.createElement('textarea')
                textarea.value = markdown
                textarea.style.position = 'fixed'
                textarea.style.left = '-999999px'
                textarea.style.top = '-999999px'
                document.body.appendChild(textarea)
                textarea.focus()
                textarea.select()
                document.execCommand('copy')
                document.body.removeChild(textarea)
            }
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy markdown:', err)
        }
    }

    return (
        <motion.button
            onClick={handleCopy}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Copy current page as Markdown"
            aria-label="Copy as Markdown"
            className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md transition-colors duration-200 cursor-pointer select-none border ${
                copied
                    ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-emerald-500/10'
                    : 'bg-white/90 dark:bg-zinc-900/90 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-white shadow-slate-900/5 dark:shadow-black/40'
            }`}
        >
            <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                    <motion.span
                        key="copied"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Copied as MD!</span>
                    </motion.span>
                ) : (
                    <motion.span
                        key="copy"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                        </svg>
                        <span>Copy as MD</span>
                    </motion.span>
                )}
            </AnimatePresence>
        </motion.button>
    )
}
