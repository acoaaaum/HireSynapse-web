import { useState, useEffect } from 'react'
import './AddDictModal.css'

function AddDictModal({ initialValue, dictType, onClose, onSave }) {
    const [alias, setAlias] = useState(initialValue || '')
    const [standard, setStandard] = useState('')
    const [suggestions, setSuggestions] = useState([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [existingStandards, setExistingStandards] = useState([])

    useEffect(() => {
        // 加载现有的标准名称用于建议
        const loadStandards = async () => {
            try {
                const response = await fetch(`/api/dictionaries/${dictType}`)
                if (response.ok) {
                    const data = await response.json()
                    const dict = dictType === 'company' ? data.companies : data.universities
                    const standards = Object.keys(dict || {})
                    setExistingStandards(standards)
                }
            } catch (error) {
                console.error('加载字典失败:', error)
            }
        }
        loadStandards()
    }, [dictType])

    useEffect(() => {
        // 根据输入过滤建议
        if (standard.trim() && existingStandards.length > 0) {
            const filtered = existingStandards.filter(s =>
                s.toLowerCase().includes(standard.toLowerCase())
            ).slice(0, 5)
            setSuggestions(filtered)
            setShowSuggestions(filtered.length > 0)
        } else {
            setSuggestions([])
            setShowSuggestions(false)
        }
    }, [standard, existingStandards])

    const handleSelectSuggestion = (suggestion) => {
        setStandard(suggestion)
        setShowSuggestions(false)
    }

    const handleSave = () => {
        if (!alias.trim()) {
            alert('别名不能为空')
            return
        }

        if (!standard.trim()) {
            alert('请输入或选择标准名称')
            return
        }

        onSave({
            alias: alias.trim(),
            standard: standard.trim()
        })
    }

    return (
        <div className="add-dict-modal" onClick={onClose}>
            <div className="add-dict-content" onClick={(e) => e.stopPropagation()}>
                <div className="add-dict-header">
                    <h3>添加{dictType === 'company' ? '公司' : '院校'}别名映射</h3>
                    <button className="add-dict-close" onClick={onClose}>×</button>
                </div>

                <div className="add-dict-body">
                    <div className="add-dict-field">
                        <label>识别的名称(别名) *</label>
                        <input
                            type="text"
                            value={alias}
                            onChange={(e) => setAlias(e.target.value)}
                            placeholder={`例如: ${dictType === 'company' ? 'Tencent' : 'THU'}`}
                        />
                        <div className="help-text">
                            这是从简历中识别出的名称,将作为别名保存
                        </div>
                    </div>

                    <div className="add-dict-field" style={{ position: 'relative' }}>
                        <label>映射到标准名称 *</label>
                        <input
                            type="text"
                            value={standard}
                            onChange={(e) => setStandard(e.target.value)}
                            onFocus={() => setShowSuggestions(suggestions.length > 0)}
                            placeholder={`输入或选择标准名称,例如: ${dictType === 'company' ? '腾讯' : '清华大学'}`}
                        />
                        <div className="help-text">
                            选择已有的标准名称,或输入新的标准名称
                        </div>

                        {showSuggestions && suggestions.length > 0 && (
                            <div className="suggestions-dropdown">
                                {suggestions.map((suggestion, index) => (
                                    <div
                                        key={index}
                                        className="suggestion-item"
                                        onClick={() => handleSelectSuggestion(suggestion)}
                                    >
                                        {suggestion}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mapping-preview">
                        <div className="preview-label">映射预览:</div>
                        <div className="preview-content">
                            <span className="preview-alias">{alias || '(别名)'}</span>
                            <span className="preview-arrow">→</span>
                            <span className="preview-standard">{standard || '(标准名称)'}</span>
                        </div>
                    </div>
                </div>

                <div className="add-dict-footer">
                    <button className="btn-cancel" onClick={onClose}>
                        取消
                    </button>
                    <button
                        className="btn-save"
                        onClick={handleSave}
                        disabled={!alias.trim() || !standard.trim()}
                    >
                        保存映射
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AddDictModal
