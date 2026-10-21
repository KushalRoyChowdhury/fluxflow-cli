import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useDocContext } from './DocContext'

const pageVariants = {
    initial: {
        opacity: 0,
        y: 20
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.45,
            ease: [0.32, 0.72, 0, 1]
        }
    },
    exit: {
        opacity: 0,
        y: -12,
        transition: {
            duration: 0.2,
            ease: [0.4, 0, 0.2, 1]
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
                className="mt-24 pt-8 border-t relative border-slate-100 dark:border-slate-800"
            >
                <p className="text-sm text-slate-500 dark:text-slate-500">
                    Caught a mistake or want to contribute to the documentation?
                    <a href="https://github.com/KushalRoyChowdhury/fluxflow-cli" className="ml-1 text-blue-600 dark:text-blue-400 font-medium hover:underline select-none">Edit this page on GitHub</a>
                </p>
                <div className='text-sm text-slate-500 dark:text-slate-500'>Updated: 2026OCT22 (v4.39.0)</div>
                {/* <div className='text-transparent select-none h-1 w-1'>HUGE THANKS TO GEMINI CLI. (つ╥﹏╥)つ</div> */}
            </motion.footer>
        </motion.div>
    )
}
