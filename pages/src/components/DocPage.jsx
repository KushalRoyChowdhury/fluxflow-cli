import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useDocContext } from './DocContext'

const pageVariants = {
    initial: {
        opacity: 0,
        y: 20,
        scale: 0.98
    },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.4,
            ease: [0.25, 1, 0.5, 1]
        }
    },
    exit: {
        opacity: 0,
        y: -20,
        scale: 0.98,
        transition: {
            duration: 0.3,
            ease: [0.25, 1, 0.5, 1]
        }
    }
}

export default function DocPage({ headings, children }) {
    const { registerHeadings } = useDocContext()

    useEffect(() => {
        registerHeadings(headings || [])
        window.scrollTo(0, 0)
        return () => registerHeadings([])
    }, [headings, registerHeadings])

    return (
        <motion.div
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
        >
            <div className="prose prose-slate max-w-none">
                {children}
            </div>
            <motion.footer
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-24 pt-8 border-t border-slate-100 dark:border-slate-800"
            >
                <p className="text-sm text-slate-500 dark:text-slate-500">
                    Caught a mistake or want to contribute to the documentation?
                    <a href="https://github.com/KushalRoyChowdhury/fluxflow-cli" className="ml-1 text-blue-600 dark:text-blue-400 font-medium hover:underline">Edit this page on GitHub</a>
                </p>
                <div className='absolute text-transparent'>HUGE THANKS TO GEMINI CLI. YOU WILL BE MISSED. (つ╥﹏╥)つ JUNE 18 (Today JUNE 16).</div>
            </motion.footer>
        </motion.div>
    )
}
