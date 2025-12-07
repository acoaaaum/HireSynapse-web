import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import './UploadArea.css'

function UploadArea({ onFilesSelected }) {
    const { t } = useTranslation()
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef(null)

    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files).filter(
            file => file.type === 'application/pdf'
        )

        if (files.length > 0) {
            onFilesSelected(files)
        }
    }

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files)
        if (files.length > 0) {
            onFilesSelected(files)
        }
    }

    const handleClick = () => {
        fileInputRef.current?.click()
    }

    return (
        <div
            className={`upload-area ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            <div className="upload-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
            </div>

            <h2 className="upload-title">{t('upload_area.title')}</h2>
            <p className="upload-subtitle">{t('upload_area.subtitle')}</p>

            <button className="btn btn-primary upload-button">
                {t('upload_area.button')}
            </button>

            {/* 装饰性粒子效果 */}
            <div className="particles">
                {[...Array(20)].map((_, i) => (
                    <div key={i} className="particle" style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 3}s`,
                        animationDuration: `${3 + Math.random() * 2}s`
                    }} />
                ))}
            </div>
        </div>
    )
}

export default UploadArea
