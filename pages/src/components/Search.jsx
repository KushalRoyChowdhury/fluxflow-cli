import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { searchIndex } from '../data/searchIndex'

export default function Search() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef(null)

  // Fuzzy match logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const q = query.toLowerCase()
    const matches = searchIndex
      .map(item => {
        let score = 0
        if (item.title.toLowerCase().includes(q)) score += 10
        if (item.keywords.some(k => k.toLowerCase().includes(q))) score += 5
        if (item.description.toLowerCase().includes(q)) score += 2
        return { ...item, score }
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)

    setResults(matches)
    setSelectedIndex(0)
  }, [query])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const handleSelect = (item) => {
    setOpen(false)
    setQuery('')
    navigate(item.path)
    // Small delay to allow navigation before scrolling
    setTimeout(() => {
      const el = document.getElementById(item.section)
      if (el) {
        const top = el.getBoundingClientRect().top + window.pageYOffset - 80
        window.scrollTo({ top, behavior: 'smooth' })
      }
    }, 100)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex])
    }
  }

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-200 mb-8"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="text-sm font-medium flex-1 text-left">Quick Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-[10px] font-bold text-slate-400">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border dark:border-white/10"
            >
              <div className="flex items-center px-4 py-4 border-b dark:border-white/5">
                <svg className="w-5 h-5 text-slate-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Search documentation, tools, or commands..."
                  className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400 text-lg"
                />
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-2">
                {results.length > 0 ? (
                  <div className="space-y-1">
                    {results.map((item, idx) => (
                      <button
                        key={`${item.path}-${item.section}`}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-100 flex flex-col items-start px-4 py-3 rounded-xl transition-all duration-200 ${
                          idx === selectedIndex 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                            : 'hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-bold uppercase tracking-wider ${idx === selectedIndex ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'}`}>
                            {item.path.replace('/', '') || 'Overview'}
                          </span>
                          <span className={idx === selectedIndex ? 'text-blue-200' : 'text-slate-300 dark:text-slate-600'}>•</span>
                          <span className={`font-bold ${idx === selectedIndex ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                            {item.title}
                          </span>
                        </div>
                        <p className={`text-sm text-left ${idx === selectedIndex ? 'text-blue-50' : 'text-slate-500 dark:text-slate-400'}`}>
                          {item.description}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : query ? (
                  <div className="py-12 text-center">
                    <p className="text-slate-500 dark:text-slate-400">No results found for "{query}"</p>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-slate-500 dark:text-slate-400">Start typing to search...</p>
                  </div>
                )}
              </div>

              <div className="px-4 py-3 bg-slate-50 dark:bg-black/40 border-t dark:border-white/5 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-[10px] font-bold text-slate-500">ENTER</kbd>
                  <span className="text-[10px] text-slate-500 font-medium">to select</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-[10px] font-bold text-slate-500">↑↓</kbd>
                  <span className="text-[10px] text-slate-500 font-medium">to navigate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-[10px] font-bold text-slate-500">ESC</kbd>
                  <span className="text-[10px] text-slate-500 font-medium">to close</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
