import { useTranslation } from 'react-i18next'
import './ResumeList.css'

function ResumeList({ resumes, onStartParse, onReview, onImportAll, onRetry, onUploadMore }) {
    const { t } = useTranslation()

    const getStatusBadge = (status) => {
        const badges = {
            pending: { text: t('resume_list.status.pending'), class: 'status-pending' },
            parsing: { text: t('resume_list.status.parsing'), class: 'status-parsing' },
            completed: { text: t('resume_list.status.completed'), class: 'status-completed' },
            failed: { text: t('resume_list.status.failed'), class: 'status-failed' },
            duplicate: { text: t('resume_list.status.duplicate'), class: 'status-duplicate' }
        }
        return badges[status] || badges.pending
    }

    const hasPendingResumes = resumes.some(r => r.status === 'pending')
    const hasCompletedResumes = resumes.some(r => r.status === 'completed' || r.status === 'duplicate')

    return (
        <div className="resume-list-container">
            <div className="resume-list-header">
                <h2>{t('resume_list.title')}</h2>
                <div className="resume-list-actions">
                    {hasPendingResumes && (
                        <button className="btn btn-primary" onClick={onStartParse}>
                            {t('resume_list.actions.start_parse')}
                        </button>
                    )}
                    {hasCompletedResumes && (
                        <button className="btn btn-primary" onClick={onImportAll}>
                            {t('resume_list.actions.import_all')}
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={onUploadMore}>
                        {t('resume_list.actions.upload_more')}
                    </button>
                </div>
            </div>

            <div className="resume-list">
                {resumes.map((resume) => {
                    const badge = getStatusBadge(resume.status)

                    return (
                        <div key={resume.id} className="resume-item card">
                            <div className="resume-info">
                                <div className="resume-icon">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                        <polyline points="10 9 9 9 8 9" />
                                    </svg>
                                </div>
                                <div className="resume-details">
                                    <div className="resume-name">{resume.name}</div>
                                    <div className="resume-status-row">
                                        <div className={`resume-status ${badge.class}`}>
                                            {badge.text}
                                        </div>
                                        {resume.importedToNotion && (
                                            <div className="resume-status status-imported">
                                                {t('resume_list.status.imported')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="resume-actions">
                                {resume.status === 'completed' || resume.status === 'duplicate' ? (
                                    <button className="btn btn-secondary" onClick={() => onReview(resume.id)}>
                                        {t('resume_list.actions.review')}
                                    </button>
                                ) : resume.status === 'failed' ? (
                                    <button className="btn btn-secondary" onClick={() => onRetry(resume.id)}>
                                        {t('resume_list.actions.retry')}
                                    </button>
                                ) : resume.status === 'parsing' ? (
                                    <div className="spinner-small"></div>
                                ) : null}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default ResumeList
