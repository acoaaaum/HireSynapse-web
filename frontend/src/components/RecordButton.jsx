import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './RecordButton.css'

function RecordButton() {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const [showTooltip, setShowTooltip] = useState(false)

    const handleClick = () => {
        navigate('/history')
    }

    return (
        <div
            className="record-button-wrapper"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <button
                className="record-button"
                onClick={handleClick}
            >
                <img src="/icons/Record.svg" alt="Record" width="24" height="24" />
            </button>
            {showTooltip && (
                <div className="record-tooltip">{t('history.tooltip')}</div>
            )}
        </div>
    )
}

export default RecordButton
