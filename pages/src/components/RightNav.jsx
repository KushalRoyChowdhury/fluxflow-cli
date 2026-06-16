import { useEffect, useState, useRef } from 'react'
import { useDocContext } from './DocContext'

export default function RightNav() {
    const { headings } = useDocContext()
    const [activeId, setActiveId] = useState(null)
    const observerRef = useRef(null)

    useEffect(() => {
        if (headings.length === 0) return

        const ids = headings.map((h) => h.id)
        const elements = ids.map((id) => document.getElementById(id)).filter(Boolean)
        if (elements.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id)
                    }
                }
            },
            { rootMargin: '-100px 0px -60% 0px', threshold: 0 }
        )

        elements.forEach((el) => observer.observe(el))
        observerRef.current = observer

        return () => {
            observer.disconnect()
        }
    }, [headings])

    if (headings.length === 0) return null

    return (
        <aside className="w-64 select-none sticky top-0 h-screen overflow-y-auto py-12 pr-6">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mb-4 ml-4">
                On this page
            </p>
            <nav className="relative">
                <div
                    className="absolute left-0 w-px bg-slate-200 dark:bg-white/10 h-full"
                    aria-hidden="true"
                />
                <ul className="space-y-2 relative">
                    {headings.map((h) => (
                        <li key={h.id}>
                            <a
                                href={`#${h.id}`}
                                onClick={(e) => {
                                    e.preventDefault()
                                    const el = document.getElementById(h.id)
                                    if (el) {
                                        const top = el.getBoundingClientRect().top + window.pageYOffset - 80
                                        window.scrollTo({ top, behavior: 'smooth' })
                                        setActiveId(h.id)
                                    }
                                }}
                                className={`group flex items-center text-[13px] leading-5 py-1 transition-all duration-200 ${h.level === 3 ? 'pl-6' : 'pl-4'
                                    } ${activeId === h.id
                                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                                        : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                            >
                                {activeId === h.id && (
                                    <div className="absolute left-0 w-0.5 h-4 bg-blue-600 dark:bg-blue-400 rounded-full" />
                                )}
                                <span className="truncate">{h.text}</span>
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    )
}
