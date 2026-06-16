import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { navItems } from '../data/navigation'
import Search from './Search'

export default function Sidebar() {
    return (
        <aside className="hidden lg:block w-72 shrink-0 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-black h-screen sticky top-0 overflow-y-auto transition-colors duration-300">
            <div className="p-8">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-10 flex items-center gap-3"
                >
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">FluxFlow</h1>
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-500 uppercase tracking-widest -mt-1">Framework</p>
                    </div>
                </motion.div>

                <Search />

                <nav className="space-y-8">
                    {navItems.map((section, sIdx) => (
                        <motion.div
                            key={section.title}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: sIdx * 0.1 + 0.2 }}
                        >
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-4 ml-3">
                                {section.title}
                            </p>
                            <ul className="space-y-1">
                                {section.children.map((item) => (
                                    <li key={item.path}>
                                        <NavLink
                                            to={item.path}
                                            className={({ isActive }) =>
                                                `group flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
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

                <div className="pt-3.5 border-t border-slate-100 dark:border-white/5 absolute bottom-3.5 w-[80%]">
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
            </div>
        </aside>
    )
}
