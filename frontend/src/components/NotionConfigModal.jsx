import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './NotionConfigModal.css'

function NotionConfigModal({ onClose }) {
    const { t } = useTranslation()
    const [config, setConfig] = useState({
        token: '',
        databaseId: '',
        uploadAttachment: true,
        fieldMapping: {}
    })
    const [databases, setDatabases] = useState([])
    const [databaseSchema, setDatabaseSchema] = useState(null)
    const [loading, setLoading] = useState(false)

    // 标准字段定义
    const standardFields = [
        { key: 'name', label: '姓名', required: true },
        { key: 'phone', label: '电话', required: false },
        { key: 'email', label: '邮箱', required: false },
        { key: 'current_company', label: '当前公司', required: false },
        { key: 'current_position', label: '当前职位', required: false },
        { key: 'education', label: '最高学历', required: false },
        { key: 'university', label: '毕业院校', required: false },
        { key: 'graduation_year', label: '本科毕业时间', required: false },
        { key: 'location', label: '现居地点', required: false }
    ]

    useEffect(() => {
        // 从 localStorage 加载配置
        const savedConfig = localStorage.getItem('notionConfig')
        const savedDatabases = localStorage.getItem('notionDatabases')

        if (savedConfig) {
            const parsed = JSON.parse(savedConfig)
            setConfig(parsed)

            // 如果有保存的数据库ID,自动加载schema
            if (parsed.databaseId && parsed.token) {
                fetchDatabaseSchema(parsed.databaseId, parsed.token)
            }
        }

        if (savedDatabases) {
            setDatabases(JSON.parse(savedDatabases))
        }
    }, [])

    const handleTokenChange = (e) => {
        setConfig({ ...config, token: e.target.value })
    }

    const handleFetchDatabases = async () => {
        if (!config.token) {
            alert('请先输入 Integration Token')
            return
        }

        setLoading(true)
        try {
            const params = new URLSearchParams({ token: config.token })
            const response = await fetch(`/api/config/notion/databases?${params}`)
            const data = await response.json()
            const dbList = data.databases || []

            setDatabases(dbList)
            // 缓存数据库列表
            localStorage.setItem('notionDatabases', JSON.stringify(dbList))
        } catch (error) {
            console.error('获取数据库列表失败:', error)
            alert('获取数据库列表失败')
        } finally {
            setLoading(false)
        }
    }

    const fetchDatabaseSchema = async (databaseId, token) => {
        if (!databaseId || !token) return

        setLoading(true)
        try {
            const params = new URLSearchParams({ token })
            const response = await fetch(`/api/config/notion/database/${databaseId}/schema?${params}`)
            const data = await response.json()
            setDatabaseSchema(data.schema || {})
        } catch (error) {
            console.error('获取数据库结构失败:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDatabaseChange = async (e) => {
        const databaseId = e.target.value
        setConfig({ ...config, databaseId, fieldMapping: {} })

        if (databaseId && config.token) {
            await fetchDatabaseSchema(databaseId, config.token)
        } else {
            setDatabaseSchema(null)
        }
    }

    const handleFieldMapping = (standardField, notionField) => {
        setConfig({
            ...config,
            fieldMapping: {
                ...config.fieldMapping,
                [standardField]: notionField
            }
        })
    }

    const handleSave = () => {
        // 验证必填字段
        const hasNameMapping = config.fieldMapping['name']
        if (!hasNameMapping) {
            alert('请至少映射"姓名"字段')
            return
        }

        localStorage.setItem('notionConfig', JSON.stringify(config))
        alert(t('messages.success.config_saved'))
        onClose()
    }

    const maskToken = (token) => {
        if (!token || token.length < 8) return token
        return token.substring(0, 4) + '****' + token.substring(token.length - 4)
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content notion-modal-large" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{t('modals.notion.title')}</h2>
                    <button className="modal-close" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>{t('modals.notion.token')}</label>
                        <input
                            type="password"
                            className="input"
                            value={config.token}
                            onChange={handleTokenChange}
                            placeholder="secret_xxxxxxxxxxxxx"
                        />
                        {config.token && (
                            <div className="token-display">{maskToken(config.token)}</div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>{t('modals.notion.database')}</label>
                        <div className="database-selector">
                            <select
                                className="input"
                                value={config.databaseId}
                                onChange={handleDatabaseChange}
                            >
                                <option value="">选择数据库</option>
                                {databases.map((db) => (
                                    <option key={db.id} value={db.id}>
                                        {db.title}
                                    </option>
                                ))}
                            </select>
                            <button
                                className="btn btn-secondary"
                                onClick={handleFetchDatabases}
                                disabled={loading}
                            >
                                {loading ? '加载中...' : '获取列表'}
                            </button>
                        </div>
                    </div>

                    {/* 字段映射部分 */}
                    {databaseSchema && config.databaseId && (
                        <div className="field-mapping-section">
                            <h3>字段映射</h3>
                            <p className="mapping-hint">将标准字段映射到您的 Notion 数据库字段</p>

                            <div className="mapping-table">
                                <div className="mapping-header">
                                    <div>标准字段</div>
                                    <div>→</div>
                                    <div>Notion 字段</div>
                                </div>

                                {standardFields.map((field) => (
                                    <div key={field.key} className="mapping-row">
                                        <div className="standard-field">
                                            {field.label}
                                            {field.required && <span className="required">*</span>}
                                        </div>
                                        <div className="arrow">→</div>
                                        <div className="notion-field">
                                            <select
                                                className="input"
                                                value={config.fieldMapping[field.key] || ''}
                                                onChange={(e) => handleFieldMapping(field.key, e.target.value)}
                                            >
                                                <option value="">不映射</option>
                                                {Object.keys(databaseSchema).map((notionField) => (
                                                    <option key={notionField} value={notionField}>
                                                        {notionField} ({databaseSchema[notionField].type})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={config.uploadAttachment}
                                onChange={(e) => setConfig({ ...config, uploadAttachment: e.target.checked })}
                            />
                            <span>{t('modals.notion.upload_attachment')}</span>
                        </label>
                    </div>

                    {/* Files字段选择 */}
                    {config.uploadAttachment && databaseSchema && (
                        <div className="form-group">
                            <label>PDF附件字段</label>
                            <select
                                className="input"
                                value={config.attachmentField || ''}
                                onChange={(e) => setConfig({ ...config, attachmentField: e.target.value })}
                            >
                                <option value="">自动识别第一个Files字段</option>
                                {Object.keys(databaseSchema)
                                    .filter(field => databaseSchema[field].type === 'files')
                                    .map((field) => (
                                        <option key={field} value={field}>
                                            {field}
                                        </option>
                                    ))}
                            </select>
                            <p className="field-hint">选择用于存储PDF附件的Files字段</p>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        取消
                    </button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        {t('modals.notion.save')}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default NotionConfigModal
