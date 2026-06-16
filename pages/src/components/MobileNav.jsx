import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { navItems } from '../data/navigation'

export default function MobileNav() {
    const [open, setOpen] = useState(false)

    return (
        <div className="lg:hidden sticky top-0 z-40 transition-colors duration-300">
            <div className="flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white tracking-tight">FluxFlow</span>
                </div>
                <button
                    onClick={() => setOpen(!open)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    aria-label="Toggle navigation"
                >
                    <svg className="w-6 h-6 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {open ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>
            </div>

            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40"
                            onClick={() => setOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed left-0 top-0 bottom-0 w-72 bg-white dark:bg-black z-50 overflow-y-auto px-6 py-8 shadow-2xl border-r dark:border-white/10"
                        >
                            <div className="flex items-center gap-3 mb-10">
                                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">FluxFlow</span>
                            </div>
                            <nav className="space-y-8">
                                {navItems.map((section, sIdx) => (
                                    <motion.div
                                        key={section.title}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 + sIdx * 0.1 }}
                                    >
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-4 ml-3">
                                            {section.title}
                                        </p>
                                        <ul className="space-y-1">
                                            {section.children.map((item) => (
                                                <li key={item.path}>
                                                    <NavLink
                                                        to={item.path}
                                                        onClick={() => setOpen(false)}
                                                        className={({ isActive }) =>
                                                            `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                                                : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                                                            }`
                                                        }
                                                    >
                                                        {({ isActive }) => (
                                                            <>
                                                                <span className={`w-1.5 h-1.5 rounded-full mr-3 transition-all duration-300 ${isActive ? 'bg-blue-600 opacity-100' : 'bg-slate-300 dark:bg-slate-700 opacity-0 group-hover:opacity-100'
                                                                    }`} />
                                                                {item.title}
                                                            </>
                                                        )}
                                                    </NavLink>
                                                </li>
                                            ))}
                                        </ul>
                                    </motion.div>
                                ))}
                            </nav>

                            <div className="mt-12 pt-8 border-t border-slate-100 dark:border-white/5">
                                <a
                                    href="/changelog"
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Changelog
                                </a>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
