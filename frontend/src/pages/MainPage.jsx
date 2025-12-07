import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import UploadArea from '../components/UploadArea'
import ResumeList from '../components/ResumeList'
import FloatingToolbar from '../components/FloatingToolbar'
import RecordButton from '../components/RecordButton'
import NotionConfigModal from '../components/NotionConfigModal'
import AIConfigModal from '../components/AIConfigModal'
import DictionaryModal from '../components/DictionaryModal'
import LanguageSwitcher from '../components/LanguageSwitcher'
import './MainPage.css'

function MainPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const toast = useToast()

    const [resumes, setResumes] = useState([])
    const [showNotionModal, setShowNotionModal] = useState(false)
    const [showAIModal, setShowAIModal] = useState(false)
    const [showDictModal, setShowDictModal] = useState(false)

    // 加载历史记录
    useEffect(() => {
        const stored = localStorage.getItem('resume_history')
        if (stored) {
            try {
                const { resumes: storedResumes } = JSON.parse(stored)
                if (storedResumes && storedResumes.length > 0) {
                    setResumes(storedResumes)
                }
            } catch (error) {
                console.error('加载历史记录失败:', error)
            }
        }
    }, [])

    // 保存到历史记录(最多200条)
    useEffect(() => {
        if (resumes.length > 0) {
            const toSave = resumes.slice(0, 200) // 只保留最新200条
            localStorage.setItem('resume_history', JSON.stringify({
                resumes: toSave
            }))
        }
    }, [resumes])

    const handleFilesSelected = async (files) => {
        const newResumes = Array.from(files).map((file, index) => ({
            id: Date.now() + index,
            file,
            name: file.name,
            status: 'pending',
            parsedData: null,
            error: null,
            uploadTime: new Date().toISOString()
        }))

        setResumes(prev => [...prev, ...newResumes])

        // 上传文件到后端
        for (const resume of newResumes) {
            try {
                const formData = new FormData()
                formData.append('file', resume.file)

                const response = await fetch('/api/resumes/upload', {
                    method: 'POST',
                    body: formData
                })

                if (!response.ok) {
                    throw new Error('上传失败')
                }

                const data = await response.json()

                // 更新简历的文件路径
                setResumes(prev => prev.map(r =>
                    r.id === resume.id ? { ...r, filePath: data.path } : r
                ))
            } catch (error) {
                console.error(`上传失败 [${resume.name}]:`, error)
                toast.error(t('toast.upload.failed', { name: resume.name, error: error.message }))
                setResumes(prev => prev.map(r =>
                    r.id === resume.id ? { ...r, status: 'failed', error: error.message } : r
                ))
            }
        }
    }

    const handleStartParse = async () => {
        // 获取AI配置
        const aiConfig = localStorage.getItem('aiConfig')
        if (!aiConfig) {
            toast.warning(t('toast.ai.config_required'))
            setShowAIModal(true)
            return
        }

        const config = JSON.parse(aiConfig)
        const pendingResumes = resumes.filter(r => r.status === 'pending')

        // 显示加载提示
        const loadingId = toast.info(t('toast.parse.loading'), 0)

        try {
            for (const resume of pendingResumes) {
                try {
                    // 更新状态为解析中
                    setResumes(prev => prev.map(r =>
                        r.id === resume.id ? { ...r, status: 'parsing' } : r
                    ))

                    // 调用解析API
                    const formData = new FormData()
                    formData.append('file_path', resume.filePath)
                    formData.append('ai_config', JSON.stringify(config))

                    const response = await fetch('/api/resumes/parse', {
                        method: 'POST',
                        body: formData
                    })

                    if (!response.ok) {
                        throw new Error('解析失败')
                    }

                    const data = await response.json()

                    // 检查是否重复
                    const notionConfig = localStorage.getItem('notionConfig')
                    let isDuplicate = false

                    if (notionConfig) {
                        const notion = JSON.parse(notionConfig)
                        if (notion.token && notion.databaseId && notion.fieldMapping) {
                            const dupCheckForm = new FormData()
                            dupCheckForm.append('database_id', notion.databaseId)
                            dupCheckForm.append('notion_token', notion.token)
                            dupCheckForm.append('phone', data.data.phone || '')
                            dupCheckForm.append('email', data.data.email || '')
                            dupCheckForm.append('field_mapping', JSON.stringify(notion.fieldMapping))

                            const dupResponse = await fetch('/api/resumes/check-duplicate', {
                                method: 'POST',
                                body: dupCheckForm
                            })

                            if (dupResponse.ok) {
                                const dupData = await dupResponse.json()
                                isDuplicate = dupData.duplicate
                                console.log('查重结果:', dupData)

                                // 保存重复数据以便后续使用
                                if (isDuplicate && dupData.data) {
                                    // 更新状态,保存duplicateData
                                    setResumes(prev => prev.map(r =>
                                        r.id === resume.id ? {
                                            ...r,
                                            status: 'duplicate',
                                            parsedData: data.data,
                                            duplicateData: dupData.data
                                        } : r
                                    ))
                                    continue // 跳过后续的状态更新
                                }
                            } else {
                                console.error('查重API调用失败:', await dupResponse.text())
                            }
                        } else {
                            console.log('查重: Notion配置不完整,跳过查重')
                        }
                    }

                    // 更新状态(非重复情况)
                    setResumes(prev => prev.map(r =>
                        r.id === resume.id ? {
                            ...r,
                            status: 'completed',
                            parsedData: data.data
                        } : r
                    ))

                } catch (error) {
                    console.error(`解析失败 [${resume.name}]:`, error)
                    toast.error(t('toast.parse.failed', { name: resume.name, error: error.message }))
                    setResumes(prev => prev.map(r =>
                        r.id === resume.id ? { ...r, status: 'failed', error: error.message } : r
                    ))
                }
            }
        } finally {
            // 移除加载提示
            toast.removeToast(loadingId)
        }

        toast.success(t('toast.parse.complete'), 5000)
    }

    const handleReview = (resumeId) => {
        const resume = resumes.find(r => r.id === resumeId)
        if (!resume) {
            toast.error(t('toast.review.not_found'))
            return
        }

        if (!resume.parsedData) {
            toast.warning(t('toast.review.not_parsed'))
            return
        }

        const resumesToPass = resumes.filter(r => r.parsedData)
        if (resumesToPass.length === 0) {
            toast.warning(t('toast.review.no_parsed'))
            return
        }

        navigate('/review', { state: { resumes: resumesToPass, currentId: resumeId } })
    }

    const handleImportAll = async () => {
        const notionConfig = localStorage.getItem('notionConfig')
        if (!notionConfig) {
            toast.warning(t('toast.notion.config_required'))
            setShowNotionModal(true)
            return
        }

        const config = JSON.parse(notionConfig)
        const completedResumes = resumes.filter(r => r.status === 'completed')

        let successCount = 0
        let failCount = 0
        let failedResumes = []

        // 显示加载提示
        const loadingId = toast.info(t('toast.import.loading'), 0)

        try {
            for (const resume of completedResumes) {
                try {
                    const formData = new FormData()
                    formData.append('database_id', config.databaseId)
                    formData.append('notion_token', config.token)
                    formData.append('data', JSON.stringify(resume.parsedData))
                    formData.append('field_mapping', JSON.stringify(config.fieldMapping))
                    if (config.uploadAttachment && resume.filePath) {
                        formData.append('pdf_file_path', resume.filePath)
                    }

                    const response = await fetch('/api/resumes/save-to-notion', {
                        method: 'POST',
                        body: formData
                    })

                    if (!response.ok) {
                        const data = await response.json()
                        throw new Error(data.message || '导入失败')
                    }

                    successCount++
                    toast.success(t('toast.import.success_single', { name: resume.name }), 5000)
                } catch (error) {
                    failCount++
                    failedResumes.push(resume.name)
                    console.error('导入失败:', error)
                    toast.error(t('toast.import.failed_single', { name: resume.name, error: error.message }))
                }
            }
        } finally {
            // 移除加载提示
            toast.removeToast(loadingId)
        }

        // 限制显示失败简历数量
        const displayFailed = failedResumes.slice(0, 3)
        const moreCount = failedResumes.length - 3
        const failedNames = displayFailed.join(', ') + (moreCount > 0 ? ` 等${moreCount}个` : '')

        if (completedResumes.length > 0) {
            if (failCount === 0) {
                toast.success(t('toast.import.all_success', { count: successCount }), 5000)
            } else if (successCount === 0) {
                toast.error(t('toast.import.all_failed', { count: failCount, names: failedNames }))
            } else {
                toast.warning(t('toast.import.partial', {
                    success: successCount,
                    failed: failCount,
                    names: failedNames
                }))
            }
        } else {
            toast.info(t('toast.import.no_completed'))
        }
    }

    const handleRetry = async (resumeId) => {
        const resume = resumes.find(r => r.id === resumeId)
        if (!resume) return

        setResumes(prev => prev.map(r =>
            r.id === resumeId ? { ...r, status: 'pending', error: null } : r
        ))

        // 触发重新解析
        setTimeout(() => handleStartParse(), 100)
    }

    const handleUploadMore = () => {
        // 创建隐藏的文件选择器
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.pdf'
        input.multiple = true
        input.onchange = (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFilesSelected(e.target.files)
            }
        }
        input.click()
    }

    return (
        <div className="main-page">
            {/* 顶部栏 */}
            <header className="main-header">
                <div className="logo">
                    <h1 className="text-gradient">{t('app_title')}</h1>
                </div>
                <LanguageSwitcher />
            </header>

            {/* 主内容区 */}
            <main className="main-content">
                {resumes.length === 0 ? (
                    <UploadArea onFilesSelected={handleFilesSelected} />
                ) : (
                    <ResumeList
                        resumes={resumes}
                        onStartParse={handleStartParse}
                        onReview={handleReview}
                        onImportAll={handleImportAll}
                        onRetry={handleRetry}
                        onUploadMore={handleUploadMore}
                    />
                )}
            </main>

            {/* 浮动工具栏 */}
            <FloatingToolbar
                onNotionClick={() => setShowNotionModal(true)}
                onAIClick={() => setShowAIModal(true)}
                onDictionaryClick={() => setShowDictModal(true)}
            />

            {/* 历史记录按钮 */}
            <RecordButton />

            {/* 配置弹窗 */}
            {showNotionModal && (
                <NotionConfigModal onClose={() => setShowNotionModal(false)} />
            )}
            {showAIModal && (
                <AIConfigModal onClose={() => setShowAIModal(false)} />
            )}
            {showDictModal && (
                <DictionaryModal onClose={() => setShowDictModal(false)} />
            )}
        </div>
    )
}

export default MainPage
