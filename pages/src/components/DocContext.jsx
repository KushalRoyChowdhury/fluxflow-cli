import { createContext, useContext, useState, useCallback } from 'react'

const DocContext = createContext(null)

export function DocProvider({ children }) {
    const [headings, setHeadings] = useState([])

    const registerHeadings = useCallback((h) => {
        setHeadings(h)
    }, [])

    return (
        <DocContext.Provider value={{ headings, registerHeadings }}>
            {children}
        </DocContext.Provider>
    )
}

export function useDocContext() {
    const ctx = useContext(DocContext)
    if (!ctx) throw new Error('useDocContext must be used within DocProvider')
    return ctx
}
