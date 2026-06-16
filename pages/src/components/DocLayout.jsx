import React, { useEffect, useState } from 'react'
import { useOutlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { DocProvider } from './DocContext'
import Sidebar from './Sidebar'
import RightNav from './RightNav'
import MobileNav from './MobileNav'

export default function DocLayout() {
    const location = useLocation()
    const outlet = useOutlet()
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        setIsDark(mediaQuery.matches)

        const handler = (e) => setIsDark(e.matches)
        mediaQuery.addEventListener('change', handler)

        if (mediaQuery.matches) {
            document.documentElement.classList.add('dark')
        }

        return () => mediaQuery.removeEventListener('change', handler)
    }, [])

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [isDark])

    return (
        <DocProvider>
            <div className="flex min-h-screen bg-white dark:bg-black transition-colors duration-300">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <MobileNav />
                    <div className="flex-1 flex justify-center">
                        <main className="flex-1 min-w-0 py-12 px-6 md:px-12 lg:px-16 max-w-4xl">
                            <AnimatePresence mode="wait" initial={false}>
                                {outlet && React.cloneElement(outlet, { key: location.pathname })}
                            </AnimatePresence>
                        </main>
                        <div className="hidden xl:block w-64 shrink-0">
                            <RightNav />
                        </div>
                    </div>
                </div>
            </div>
        </DocProvider>
    )
}
