import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDictionaries } from '../contexts/DictionaryContext'
import './DictionaryModal.css'

function DictionaryModal({ onClose }) {
    const { t } = useTranslation()
    const { dictionaries, reloadDictionaries } = useDictionaries()
    const [activeTab, setActiveTab] = useState('company')
    const [companyDict, setCompanyDict] = useState({})
    const [universityDict, setUniversityDict] = useState({})
    const [newEntry, setNewEntry] = useState({ alias: '', standard: '' })
    const [searchQuery, setSearchQuery] = useState('')
    const [editingKey, setEditingKey] = useState(null)
    const [editingEntry, setEditingEntry] = useState({ standard: '', aliases: [] })

    useEffect(() => {
        // 从全局状态加载字典
        if (dictionaries.loaded) {
            setCompanyDict(dictionaries.companies || {})
            setUniversityDict(dictionaries.universities || {})
        }
    }, [dictionaries])

    const currentDict = activeTab === 'company' ? companyDict : universityDict
    const setCurrentDict = activeTab === 'company' ? setCompanyDict : setUniversityDict

    // 转换为数组格式以便显示
    const dictArray = Object.entries(currentDict).flatMap(([standard, info]) =>
        (info.aliases || []).map(alias => ({
            alias,
            standard,
            category: info.category,
            location: info.location
        }))
    )

    // 搜索过滤
    const filteredDict = dictArray.filter(entry => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
            entry.alias.toLowerCase().includes(query) ||
            entry.standard.toLowerCase().includes(query)
        )
    })

    const handleAdd = () => {
        if (!newEntry.alias || !newEntry.standard) {
            alert('请填写完整信息')
            return
        }

        const newDict = { ...currentDict }
        const standard = newEntry.standard

        if (!newDict[standard]) {
            newDict[standard] = {
                standard,
                aliases: [standard]
            }
        }

        // 添加别名(去重)
        if (!newDict[standard].aliases.includes(newEntry.alias)) {
            newDict[standard].aliases.push(newEntry.alias)
        }

        setCurrentDict(newDict)
        setNewEntry({ alias: '', standard: '' })
    }

    const handleDelete = (alias, standard) => {
        const newDict = { ...currentDict }

        if (newDict[standard]) {
            // 从别名列表中移除
            newDict[standard].aliases = newDict[standard].aliases.filter(a => a !== alias)

            // 如果没有别名了,删除整个条目
            if (newDict[standard].aliases.length === 0) {
                delete newDict[standard]
            }
        }

        setCurrentDict(newDict)
    }

    const handleEdit = (alias, standard) => {
        setEditingKey(`${standard}:${alias}`)
        setEditingEntry({
            standard,
            aliases: currentDict[standard]?.aliases || []
        })
    }

    const handleSaveEdit = (oldAlias, oldStandard) => {
        if (!editingEntry.standard) {
            alert('请填写标准名称')
            return
        }

        const newDict = { ...currentDict }

        // 删除旧条目
        if (newDict[oldStandard]) {
            newDict[oldStandard].aliases = newDict[oldStandard].aliases.filter(a => a !== oldAlias)
            if (newDict[oldStandard].aliases.length === 0) {
                delete newDict[oldStandard]
            }
        }

        // 添加新条目
        const newStandard = editingEntry.standard
        if (!newDict[newStandard]) {
            newDict[newStandard] = {
                standard: newStandard,
                aliases: [newStandard]
            }
        }

        // 添加编辑后的别名
        if (!newDict[newStandard].aliases.includes(oldAlias)) {
            newDict[newStandard].aliases.push(oldAlias)
        }

        setCurrentDict(newDict)
        setEditingKey(null)
        setEditingEntry({ standard: '', aliases: [] })
    }

    const handleCancelEdit = () => {
        setEditingKey(null)
        setEditingEntry({ standard: '', aliases: [] })
    }

    const handleSave = async () => {
        try {
            const endpoint = `/api/dictionaries/${activeTab}`
            const key = activeTab === 'company' ? 'companies' : 'universities'

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: currentDict })
            })

            if (response.ok) {
                alert(t('messages.success.save'))
                reloadDictionaries()
            } else {
                throw new Error('保存失败')
            }
        } catch (error) {
            console.error('保存字典失败:', error)
            alert(t('messages.error.save'))
        }
    }

    const handleExport = () => {
        const data = JSON.stringify(
            activeTab === 'company'
                ? { companies: companyDict }
                : { universities: universityDict },
            null,
            2
        )
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${activeTab}_dictionary.json`
        a.click()
    }

    const handleImport = (e) => {
        const file = e.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result)
                if (activeTab === 'company' && data.companies) {
                    setCompanyDict(data.companies)
                } else if (activeTab === 'university' && data.universities) {
                    setUniversityDict(data.universities)
                }
                alert('导入成功')
            } catch (error) {
                alert('导入失败:文件格式错误')
            }
        }
        reader.readAsText(file)
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content dictionary-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{t('modals.dictionary.title')}</h2>
                    <button className="modal-close" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="dictionary-tabs">
                    <button
                        className={`tab ${activeTab === 'company' ? 'active' : ''}`}
                        onClick={() => setActiveTab('company')}
                    >
                        {t('modals.dictionary.tabs.company')}
                    </button>
                    <button
                        className={`tab ${activeTab === 'university' ? 'active' : ''}`}
                        onClick={() => setActiveTab('university')}
                    >
                        {t('modals.dictionary.tabs.university')}
                    </button>
                </div>

                <div className="modal-body">
                    <div className="dictionary-actions">
                        <div className="add-entry">
                            <input
                                type="text"
                                className="input"
                                placeholder={searchQuery ? "🔍 搜索中..." : t('modals.dictionary.columns.alias')}
                                value={searchQuery || newEntry.alias}
                                onChange={(e) => {
                                    if (searchQuery !== '') {
                                        setSearchQuery(e.target.value)
                                    } else {
                                        setNewEntry({ ...newEntry, alias: e.target.value })
                                    }
                                }}
                            />
                            <input
                                type="text"
                                className="input"
                                placeholder={searchQuery ? "" : t('modals.dictionary.columns.standard')}
                                value={searchQuery ? "" : newEntry.standard}
                                onChange={(e) => setNewEntry({ ...newEntry, standard: e.target.value })}
                                disabled={searchQuery !== ''}
                            />
                            {searchQuery ? (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setSearchQuery('')
                                        setNewEntry({ alias: '', standard: '' })
                                    }}
                                >
                                    取消搜索
                                </button>
                            ) : (
                                <>
                                    <button className="btn btn-primary" onClick={handleAdd}>
                                        {t('modals.dictionary.actions.add')}
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            setSearchQuery(newEntry.alias)
                                            setNewEntry({ alias: '', standard: '' })
                                        }}
                                    >
                                        搜索
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="import-export">
                            <label className="btn btn-secondary">
                                {t('modals.dictionary.actions.import')}
                                <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                            </label>
                            <button className="btn btn-secondary" onClick={handleExport}>
                                {t('modals.dictionary.actions.export')}
                            </button>
                        </div>
                    </div>

                    {searchQuery && (
                        <div className="dictionary-stats">
                            共 {dictArray.length} 条记录 / 搜索到 {filteredDict.length} 条
                        </div>
                    )}

                    <div className="dictionary-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('modals.dictionary.columns.alias')}</th>
                                    <th>{t('modals.dictionary.columns.standard')}</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDict.map((entry, index) => {
                                    const entryKey = `${entry.standard}:${entry.alias}`
                                    const isEditing = editingKey === entryKey

                                    return (
                                        <tr key={entryKey} className={isEditing ? 'editing' : ''}>
                                            <td>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        value={entry.alias}
                                                        disabled
                                                    />
                                                ) : (
                                                    entry.alias
                                                )}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        value={editingEntry.standard}
                                                        onChange={(e) => setEditingEntry({ ...editingEntry, standard: e.target.value })}
                                                    />
                                                ) : (
                                                    entry.standard
                                                )}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <div className="row-actions">
                                                        <button
                                                            className="btn-action btn-save"
                                                            onClick={() => handleSaveEdit(entry.alias, entry.standard)}
                                                        >
                                                            保存
                                                        </button>
                                                        <button
                                                            className="btn-action btn-cancel"
                                                            onClick={handleCancelEdit}
                                                        >
                                                            取消
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="row-actions">
                                                        <button
                                                            className="btn-action btn-edit"
                                                            onClick={() => handleEdit(entry.alias, entry.standard)}
                                                        >
                                                            编辑
                                                        </button>
                                                        <button
                                                            className="btn-action btn-delete"
                                                            onClick={() => handleDelete(entry.alias, entry.standard)}
                                                        >
                                                            {t('modals.dictionary.actions.delete')}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        取消
                    </button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        保存
                    </button>
                </div>
            </div>
        </div>
    )
}

export default DictionaryModal
