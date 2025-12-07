import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '../components/Toast'
import './HistoryPage.css'

function HistoryPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const toast = useToast()

    const [history, setHistory] = useState([])
    const [filteredHistory, setFilteredHistory] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [showClearConfirm, setShowClearConfirm] = useState(false)

    // 加载历史记录
    useEffect(() => {
        loadHistory()
    }, [])

    // 筛选和搜索
    useEffect(() => {
        let filtered = history

        // 状态筛选
        if (filterStatus !== 'all') {
            filtered = filtered.filter(item => {
                if (filterStatus === 'parsed') return item.status === 'completed'
                if (filterStatus === 'imported') return item.importedToNotion
                return true
            })
        }

        // 搜索
        if (searchTerm) {
            filtered = filtered.filter(item =>
                item.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        setFilteredHistory(filtered)
    }, [history, searchTerm, filterStatus])

    const loadHistory = () => {
        const stored = localStorage.getItem('resume_history')
        if (stored) {
            const { resumes } = JSON.parse(stored)
            setHistory(resumes || [])
        }
    }

    const handleReview = (resume) => {
        // 重新构建resumes数组并跳转到审阅页面
        navigate('/review', {
            state: {
                resumes: [resume],
                currentId: resume.id
            }
        })
    }

    const handleDelete = async (resume) => {
        if (!window.confirm(`确定要删除 "${resume.name}" 吗?`)) {
            return
        }

        try {
            // 删除文件
            if (resume.filePath) {
                const response = await fetch(`/api/resumes/delete-file/${encodeURIComponent(resume.filePath)}`, {
                    method: 'DELETE'
                })

                if (!response.ok) {
                    throw new Error('文件删除失败')
                }
            }

            // 从localStorage删除
            const updated = history.filter(item => item.id !== resume.id)
            localStorage.setItem('resume_history', JSON.stringify({ resumes: updated }))
            setHistory(updated)

            toast.success(t('toast.history.delete_success', { name: resume.name }))
        } catch (error) {
            console.error(`删除失败 [${resume.name}]:`, error)
            toast.error(t('toast.history.delete_failed', { name: resume.name, error: error.message }))
        }
    }

    const handleClearAll = async () => {
        if (!showClearConfirm) {
            setShowClearConfirm(true)
            return
        }

        try {
            // 获取所有文件路径
            const filePaths = history.map(item => item.filePath).filter(Boolean)

            if (filePaths.length > 0) {
                // 调用后端API删除文件
                const response = await fetch('/api/resumes/clear-history', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ file_paths: filePaths })
                })

                if (response.ok) {
                    const result = await response.json()
                    console.log('清空结果:', result)
                    if (result.failed_files && result.failed_files.length > 0) {
                        toast.warning(t('toast.history.clear_partial', { count: result.failed_files.length }))
                    }
                } else {
                    throw new Error('清空文件失败')
                }
            }

            // 清空localStorage
            localStorage.removeItem('resume_history')
            setHistory([])
            setShowClearConfirm(false)

            toast.success(t('toast.history.clear_success'), 5000)
        } catch (error) {
            console.error('清空失败:', error)
            toast.error(t('toast.history.clear_failed', { error: error.message }))
        }
    }

    const formatDate = (dateString) => {
        if (!dateString) return '-'
        const date = new Date(dateString)
        return date.toLocaleString('zh-CN')
    }

    const getStatusText = (resume) => {
        if (resume.importedToNotion) return '已导入'
        if (resume.status === 'completed') return '已解析'
        if (resume.status === 'duplicate') return '重复'
        return '待处理'
    }

    const getStatusClass = (resume) => {
        if (resume.importedToNotion) return 'status-imported'
        if (resume.status === 'completed') return 'status-parsed'
        if (resume.status === 'duplicate') return 'status-duplicate'
        return 'status-pending'
    }

    return (
        <div className="history-page">
            <header className="history-header">
                <div className="header-left">
                    <button className="back-button" onClick={() => navigate('/')}>
                        ← {t('history.back')}
                    </button>
                    <h1>{t('history.title')}</h1>
                    <span className="count">{t('history.count', { count: history.length })}</span>
                </div>
                <div className="header-right">
                    {history.length > 0 && (
                        <button
                            className={`clear-button ${showClearConfirm ? 'confirm' : ''}`}
                            onClick={handleClearAll}
                        >
                            {showClearConfirm ? t('history.clear_confirm') : t('history.clear')}
                        </button>
                    )}
                    {showClearConfirm && (
                        <button
                            className="cancel-button"
                            onClick={() => setShowClearConfirm(false)}
                        >
                            {t('history.cancel')}
                        </button>
                    )}
                </div>
            </header>

            <div className="history-controls">
                <input
                    type="text"
                    className="search-input"
                    placeholder="搜索简历..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="filter-buttons">
                    <button
                        className={filterStatus === 'all' ? 'active' : ''}
                        onClick={() => setFilterStatus('all')}
                    >
                        全部
                    </button>
                    <button
                        className={filterStatus === 'parsed' ? 'active' : ''}
                        onClick={() => setFilterStatus('parsed')}
                    >
                        已解析
                    </button>
                    <button
                        className={filterStatus === 'imported' ? 'active' : ''}
                        onClick={() => setFilterStatus('imported')}
                    >
                        已导入
                    </button>
                </div>
            </div>

            <div className="history-list">
                {filteredHistory.length === 0 ? (
                    <div className="empty-state">
                        <p>{t('history.empty')}</p>
                    </div>
                ) : (
                    filteredHistory.map((resume) => (
                        <div key={resume.id} className="history-item">
                            <div className="item-info">
                                <h3>{resume.name}</h3>
                                <div className="item-meta">
                                    <span className={`status-badge ${getStatusClass(resume)}`}>
                                        {getStatusText(resume)}
                                    </span>
                                    <span className="upload-time">
                                        {formatDate(resume.uploadTime)}
                                    </span>
                                </div>
                            </div>
                            <div className="item-actions">
                                <button
                                    className="review-button"
                                    onClick={() => handleReview(resume)}
                                >
                                    审阅
                                </button>
                                <button
                                    className="delete-button"
                                    onClick={() => handleDelete(resume)}
                                >
                                    删除
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default HistoryPage
