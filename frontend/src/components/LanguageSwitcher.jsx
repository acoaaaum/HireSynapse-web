import { useTranslation } from 'react-i18next'
import './LanguageSwitcher.css'

function LanguageSwitcher() {
    const { i18n } = useTranslation()

    const toggleLanguage = () => {
        const newLang = i18n.language === 'zh-CN' ? 'en-US' : 'zh-CN'
        i18n.changeLanguage(newLang)
    }

    return (
        <button className="lang-switcher" onClick={toggleLanguage}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>{i18n.language === 'zh-CN' ? 'EN' : '中'}</span>
        </button>
    )
}

export default LanguageSwitcher
