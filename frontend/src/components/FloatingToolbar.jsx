import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './FloatingToolbar.css'

function FloatingToolbar({ onNotionClick, onAIClick, onDictionaryClick }) {
    const { t } = useTranslation()
    const [hoveredButton, setHoveredButton] = useState(null)

    const buttons = [
        {
            id: 'notion',
            label: t('toolbar.notion'),
            icon: (
                <img src="/icons/notion.svg" alt="Notion" width="24" height="24" />
            ),
            onClick: onNotionClick
        },
        {
            id: 'ai',
            label: t('toolbar.ai'),
            icon: (
                <img src="/icons/ai.svg" alt="AI" width="24" height="24" />
            ),
            onClick: onAIClick
        },
        {
            id: 'dictionary',
            label: t('toolbar.dictionary'),
            icon: (
                <img src="/icons/dictionary.svg" alt="Dictionary" width="24" height="24" />
            ),
            onClick: onDictionaryClick
        }
    ]

    return (
        <div className="floating-toolbar">
            {buttons.map((button) => (
                <div key={button.id} className="toolbar-button-wrapper">
                    <button
                        className="toolbar-button"
                        onClick={button.onClick}
                        onMouseEnter={() => setHoveredButton(button.id)}
                        onMouseLeave={() => setHoveredButton(null)}
                    >
                        {button.icon}
                    </button>
                    {hoveredButton === button.id && (
                        <div className="toolbar-tooltip">{button.label}</div>
                    )}
                </div>
            ))}
        </div>
    )
}

export default FloatingToolbar
