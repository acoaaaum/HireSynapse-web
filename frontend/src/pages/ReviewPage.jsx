import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '../components/Toast'
import { useDictionaries } from '../contexts/DictionaryContext'
import { Document, Page, pdfjs } from 'react-pdf'
import AddDictModal from '../components/AddDictModal'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import './ReviewPage.css'

// 配置 PDF.js worker - 使用动态版本自动匹配
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

function ReviewPage() {
    const { t } = useTranslation()
    const location = useLocation()
    const navigate = useNavigate()
    const toast = useToast()
    const { reloadDictionaries } = useDictionaries()

    const { resumes, currentId } = location.state || {}
    const [currentIndex, setCurrentIndex] = useState(0)
    const [numPages, setNumPages] = useState(null)
    const [pageNumber, setPageNumber] = useState(1)
    const [formData, setFormData] = useState({})
    const [pdfUrl, setPdfUrl] = useState(null)
    const [showAddDictModal, setShowAddDictModal] = useState(false)
    const [addDictField, setAddDictField] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)
    const [addDictValue, setAddDictValue] = useState('')

    useEffect(() => {
        if (!resumes || resumes.length === 0) {
            navigate('/')
            return
        }

        const index = resumes.findIndex(r => r.id === currentId)
        if (index !== -1) {
            setCurrentIndex(index)
            setFormData(resumes[index].parsedData || {})

            // 使用后端API加载PDF
            if (resumes[index].filePath) {
                // 从后端加载PDF文件
                const pdfPath = `/api/resumes/file/${encodeURIComponent(resumes[index].filePath)}`
                setPdfUrl(pdfPath)
            } else {
                console.warn('简历缺少文件路径:', resumes[index])
                setPdfUrl(null)
            }
        }
    }, [resumes, currentId, navigate])

    if (!resumes || resumes.length === 0) {
        return null
    }

    const currentResume = resumes[currentIndex]
    const isDuplicate = currentResume?.status === 'duplicate'

    const handleFieldChange = (field, value) => {
        setFormData({ ...formData, [field]: value })
    }

    const handleSaveToNotion = async () => {
        setIsSaving(true)
        try {
            // 检查Notion配置
            const notionConfig = localStorage.getItem('notionConfig')
            if (!notionConfig) {
                toast.warning(t('toast.notion.config_required'))
                return
            }

            const config = JSON.parse(notionConfig)
            if (!config.token || !config.databaseId) {
                toast.warning(t('toast.notion.config_incomplete'))
                return
            }

            // 准备数据
            const formDataToSend = new FormData()
            formDataToSend.append('database_id', config.databaseId)
            formDataToSend.append('notion_token', config.token)
            formDataToSend.append('data', JSON.stringify(formData))
            formDataToSend.append('field_mapping', JSON.stringify(config.fieldMapping || {}))

            // 如果需要上传附件
            if (config.uploadAttachment && currentResume.filePath) {
                formDataToSend.append('pdf_file_path', currentResume.filePath)
                // 如果指定了attachment字段,传递给后端
                if (config.attachmentField) {
                    formDataToSend.append('attachment_field', config.attachmentField)
                }
            }

            // 调用API
            const response = await fetch('/api/resumes/save-to-notion', {
                method: 'POST',
                body: formDataToSend
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || '保存失败')
            }

            const result = await response.json()
            toast.success(t('toast.notion.save_success', { pageId: result.page_id || result.id || '已创建' }), 5000)

            // 更新localStorage中的importedToNotion状态
            const stored = localStorage.getItem('resume_history')
            if (stored) {
                const { resumes: storedResumes } = JSON.parse(stored)
                const updatedResumes = storedResumes.map(r =>
                    r.id === currentResume.id ? { ...r, importedToNotion: true } : r
                )
                localStorage.setItem('resume_history', JSON.stringify({ resumes: updatedResumes }))
            }

            // 可选: 跳转回主页或下一个简历
            // navigate('/')
        } catch (error) {
            console.error('保存到Notion失败:', error)
            toast.error(t('toast.notion.save_failed', { error: error.message }))
        } finally {
            setIsSaving(false)
        }
    }

    const handleSaveToDict = (field) => {
        const value = formData[field]
        if (!value) {
            toast.warning(t('toast.dict.no_value'))
            return
        }

        // 打开配置弹窗
        setAddDictField(field)
        setAddDictValue(value)
        setShowAddDictModal(true)
    }

    const handleConfirmSaveToDict = async (config) => {
        try {
            const dictType = addDictField === 'current_company' ? 'company' : 'university'

            // 先获取现有字典
            const getResponse = await fetch(`/api/dictionaries/${dictType}`)
            if (!getResponse.ok) {
                throw new Error('获取字典失败')
            }

            const existingDict = await getResponse.json()
            const existingData = dictType === 'company'
                ? existingDict.companies || {}
                : existingDict.universities || {}

            // 检查别名是否已存在
            let existingEntry = null;
            let existingStandard = null;
            for (const [standard, info] of Object.entries(existingData)) {
                if (info.aliases && info.aliases.some(a => a.toLowerCase() === config.alias.toLowerCase())) {
                    existingEntry = info;
                    existingStandard = standard;
                    break;
                }
            }

            if (existingEntry) {
                toast.info(t('toast.dict.alias_exists', { alias: config.alias, standard: existingStandard }))
                setShowAddDictModal(false)
                return
            }

            // 添加或更新映射
            const updatedData = { ...existingData }

            if (updatedData[config.standard]) {
                // 标准名已存在,添加新别名
                const existingAliases = updatedData[config.standard].aliases || []
                updatedData[config.standard] = {
                    ...updatedData[config.standard],
                    aliases: [...new Set([...existingAliases, config.alias])] // 使用Set去重
                }
            } else {
                // 标准名不存在,创建新条目
                updatedData[config.standard] = {
                    standard: config.standard,
                    aliases: [...new Set([config.standard, config.alias])] // 使用Set去重
                }
            }

            const response = await fetch(`/api/dictionaries/${dictType}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [dictType === 'company' ? 'companies' : 'universities']: updatedData
                })
            })

            if (response.ok) {
                toast.success(t('toast.dict.save_success', { alias: config.alias, standard: config.standard }), 5000)
                setShowAddDictModal(false)
                // 刷新全局字典状态
                reloadDictionaries()
            } else {
                toast.error(t('messages.error.save'))
            }
        } catch (error) {
            console.error('保存到字典失败:', error)
            toast.error(t('messages.error.save'))
        }
    }

    const handleViewNotionRecord = () => {
        // 从解析结果中获取重复记录的URL
        const notionUrl = currentResume?.duplicateData?.url;
        if (notionUrl) {
            window.open(notionUrl, '_blank')
        } else {
            toast.warning(t('toast.notion.no_link'))
        }
    }

    const handleOverwriteUpdate = async () => {
        setIsUpdating(true)
        try {
            // 检查Notion配置
            const notionConfig = localStorage.getItem('notionConfig')
            if (!notionConfig) {
                toast.warning(t('toast.notion.config_required'))
                return
            }

            const config = JSON.parse(notionConfig)
            if (!config.token || !config.databaseId) {
                toast.warning(t('toast.notion.config_incomplete'))
                return
            }

            // 确认覆盖
            if (!confirm(t('review_page.duplicate_banner.confirm_overwrite'))) {
                return
            }

            // 准备数据
            const formDataToSend = new FormData()
            formDataToSend.append('page_id', currentResume.duplicateData.id)
            formDataToSend.append('notion_token', config.token)
            formDataToSend.append('data', JSON.stringify(formData))
            formDataToSend.append('field_mapping', JSON.stringify(config.fieldMapping || {}))
            formDataToSend.append('database_id', config.databaseId)

            // 如果需要上传附件
            if (config.uploadAttachment && currentResume.filePath) {
                formDataToSend.append('pdf_file_path', currentResume.filePath)
                if (config.attachmentField) {
                    formDataToSend.append('attachment_field', config.attachmentField)
                }
            }

            // 调用更新API
            const response = await fetch('/api/resumes/update-notion-page', {
                method: 'POST',
                body: formDataToSend
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || '更新失败')
            }

            const result = await response.json()
            toast.success(t('toast.notion.update_success'), 5000)

            // 更新localStorage中的importedToNotion状态
            const stored = localStorage.getItem('resume_history')
            if (stored) {
                const { resumes: storedResumes } = JSON.parse(stored)
                const updatedResumes = storedResumes.map(r =>
                    r.id === currentResume.id ? { ...r, importedToNotion: true } : r
                )
                localStorage.setItem('resume_history', JSON.stringify({ resumes: updatedResumes }))
            }

            // 可选: 跳转回主页或下一个简历
            // navigate('/')
        } catch (error) {
            console.error('更新Notion失败:', error)
            toast.error(t('toast.notion.update_failed', { error: error.message }))
        } finally {
            setIsUpdating(false)
        }
    }

    const handleNext = () => {
        if (currentIndex < resumes.length - 1) {
            const nextResume = resumes[currentIndex + 1]
            setCurrentIndex(currentIndex + 1)
            setFormData(nextResume.parsedData || {})
            setPageNumber(1)

            // 使用后端路径加载PDF
            if (nextResume.filePath) {
                setPdfUrl(`/api/resumes/file/${encodeURIComponent(nextResume.filePath)}`)
            }
        }
    }

    const handlePrevious = () => {
        if (currentIndex > 0) {
            const prevResume = resumes[currentIndex - 1]
            setCurrentIndex(currentIndex - 1)
            setFormData(prevResume.parsedData || {})
            setPageNumber(1)

            // 使用后端路径加载PDF
            if (prevResume.filePath) {
                setPdfUrl(`/api/resumes/file/${encodeURIComponent(prevResume.filePath)}`)
            }
        }
    }

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages)
    }

    const fields = [
        { key: 'name', label: t('review_page.fields.name') },
        { key: 'phone', label: t('review_page.fields.phone') },
        { key: 'email', label: t('review_page.fields.email') },
        { key: 'current_company', label: t('review_page.fields.current_company'), hasDict: true },
        { key: 'current_position', label: t('review_page.fields.current_position') },
        { key: 'education', label: t('review_page.fields.education') },
        { key: 'university', label: t('review_page.fields.university'), hasDict: true },
        { key: 'graduation_year', label: t('review_page.fields.graduation_year') },
        { key: 'location', label: t('review_page.fields.location') }
    ]

    return (
        <div className="review-page">
            {/* 重复提示 Banner */}
            {isDuplicate && (
                <div className="duplicate-banner">
                    <div className="banner-content">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <div>
                            <strong>{t('review_page.duplicate_banner.title')}</strong>
                            <p>{t('review_page.duplicate_banner.message')}</p>
                        </div>
                    </div>
                    <div className="banner-actions">
                        <button className="btn btn-secondary" onClick={handleViewNotionRecord}>
                            {t('review_page.duplicate_banner.view_notion')}
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleOverwriteUpdate}
                            disabled={isUpdating}
                        >
                            {isUpdating ? (
                                <>
                                    <span className="spinner-small"></span>
                                    <span>{t('review_page.actions.updating')}</span>
                                </>
                            ) : (
                                t('review_page.duplicate_banner.overwrite')
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* 三栏布局 */}
            <div className="review-container">
                {/* 左侧:简历列表 */}
                <div className="resume-sidebar">
                    <h3>{t('review_page.title')}</h3>
                    <div className="resume-list-small">
                        {resumes.map((resume, index) => (
                            <div
                                key={resume.id}
                                className={`resume-item-small ${index === currentIndex ? 'active' : ''}`}
                                onClick={() => {
                                    setCurrentIndex(index)
                                    setFormData(resume.parsedData || {})
                                    setPageNumber(1)

                                    // 使用后端路径加载PDF
                                    if (resume.filePath) {
                                        setPdfUrl(`/api/resumes/file/${encodeURIComponent(resume.filePath)}`)
                                    }
                                }}
                            >
                                <div className="resume-number">{index + 1}</div>
                                <div className="resume-name-small">{resume.name}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 中间:PDF 预览 */}
                <div className="pdf-viewer">
                    <div className="pdf-controls">
                        <span>
                            共 {numPages || '?'} 页
                        </span>
                    </div>
                    <div className="pdf-content pdf-scroll">
                        {pdfUrl ? (
                            <Document
                                file={pdfUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={<div className="spinner"></div>}
                                error={<div className="pdf-error">PDF加载失败</div>}
                                options={{
                                    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
                                    cMapPacked: true,
                                }}
                            >
                                {Array.from(new Array(numPages), (el, index) => (
                                    <div key={`page_${index + 1}`} className="pdf-page-container">
                                        <Page
                                            pageNumber={index + 1}
                                            width={600}
                                            renderTextLayer={true}
                                            renderAnnotationLayer={true}
                                        />
                                        <div className="page-number-label">
                                            第 {index + 1} 页
                                        </div>
                                    </div>
                                ))}
                            </Document>
                        ) : (
                            <div className="pdf-placeholder">无PDF文件</div>
                        )}
                    </div>
                </div>

                {/* 右侧:表单 */}
                <div className="form-panel">
                    <h3>解析结果</h3>
                    <div className="form-fields">
                        {fields.map((field) => (
                            <div key={field.key} className="form-group">
                                <label>{field.label}</label>
                                <div className="field-with-action">
                                    <input
                                        type="text"
                                        className="input"
                                        value={formData[field.key] || ''}
                                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                    />
                                    {field.hasDict && (
                                        <button
                                            className="btn-icon"
                                            onClick={() => handleSaveToDict(field.key)}
                                            title={t('review_page.actions.save_to_dict')}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                                <polyline points="17 21 17 13 7 13 7 21" />
                                                <polyline points="7 3 7 8 15 8" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="form-actions">
                        <button
                            className="btn btn-secondary"
                            onClick={handlePrevious}
                            disabled={currentIndex === 0}
                        >
                            {t('review_page.actions.previous')}
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleSaveToNotion}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <span className="spinner-small"></span>
                                    <span>{t('review_page.actions.saving')}</span>
                                </>
                            ) : (
                                t('review_page.actions.save_to_notion')
                            )}
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={handleNext}
                            disabled={currentIndex === resumes.length - 1}
                        >
                            {t('review_page.actions.next')}
                        </button>
                    </div>
                </div>
            </div>

            {/* 添加到字典弹窗 */}
            {showAddDictModal && (
                <AddDictModal
                    initialValue={addDictValue}
                    dictType={addDictField === 'current_company' ? 'company' : 'university'}
                    onClose={() => setShowAddDictModal(false)}
                    onSave={handleConfirmSaveToDict}
                />
            )}
        </div>
    )
}

export default ReviewPage
