import { createContext, useContext, useState, useEffect } from 'react'

const DictionaryContext = createContext()

export function DictionaryProvider({ children }) {
    const [dictionaries, setDictionaries] = useState({
        companies: {},
        universities: {},
        loaded: false,
        loading: false
    })

    useEffect(() => {
        loadDictionaries()
    }, [])

    const loadDictionaries = async (force = false) => {
        if (!force && (dictionaries.loading || dictionaries.loaded)) return

        setDictionaries(prev => ({ ...prev, loading: true }))

        try {
            const [compRes, univRes] = await Promise.all([
                fetch('/api/dictionaries/company'),
                fetch('/api/dictionaries/university')
            ])

            const compData = await compRes.json()
            const univData = await univRes.json()

            setDictionaries({
                companies: compData.companies || {},
                universities: univData.universities || {},
                loaded: true,
                loading: false
            })
        } catch (error) {
            console.error('加载字典失败:', error)
            setDictionaries(prev => ({ ...prev, loading: false }))
        }
    }

    const reloadDictionaries = async () => {
        // 强制重新加载
        await loadDictionaries(true)
    }

    return (
        <DictionaryContext.Provider value={{
            dictionaries,
            loadDictionaries,
            reloadDictionaries
        }}>
            {children}
        </DictionaryContext.Provider>
    )
}

export const useDictionaries = () => {
    const context = useContext(DictionaryContext)
    if (!context) {
        throw new Error('useDictionaries must be used within DictionaryProvider')
    }
    return context
}
