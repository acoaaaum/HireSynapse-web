import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './AIConfigModal.css'

function AIConfigModal({ onClose }) {
    const { t } = useTranslation()
    const [config, setConfig] = useState({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: '',  // 默认为空,不设置任何模型
        systemPrompt: `你是一个专业的简历解析助手。请从提供的简历文本中提取以下信息,并以JSON格式返回:

{
  "name": "姓名",
  "phone": "电话号码(保留原始格式)",
  "email": "邮箱地址",
  "current_company": "当前公司名称(全称)",
  "current_position": "当前职位",
  "education": "最高学历(本科/硕士/博士)",
  "university": "毕业院校(全称)",
  "graduation_year": "本科毕业年份(仅年份,如2020)",
  "location": "现居地点(城市或国家)"
}

注意:
1. 如果某个字段在简历中找不到,请返回空字符串
2. 保持公司和院校的原始名称,不要自行翻译或简化
3. 电话号码保留原始格式,包括所有符号
4. 现居地点尽可能提取详细信息
5. **重要**: graduation_year必须是本科毕业年份,即使候选人有硕士或博士学历,也要提取本科的毕业年份,而不是最高学历的毕业年份`
    })
    const [models, setModels] = useState([])
    const [loading, setLoading] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState(null)

    useEffect(() => {
        const saved = localStorage.getItem('aiConfig')
        const savedModels = localStorage.getItem('aiModels')

        if (saved) {
            const parsed = JSON.parse(saved)
            setConfig(parsed)
        }

        if (savedModels) {
            setModels(JSON.parse(savedModels))
        }

        // 如果有保存的配置,自动加载模型列表
        if (saved) {
            const parsed = JSON.parse(saved)
            if (parsed.apiKey && parsed.baseUrl) {
                // 传递保存的模型名称,避免异步状态更新问题
                handleFetchModels(parsed.baseUrl, parsed.apiKey, parsed.model)
            }
        }
    }, [])

    const handleFetchModels = async (baseUrl = config.baseUrl, apiKey = config.apiKey, currentModel = null) => {
        if (!apiKey) {
            alert('请先输入 API Key')
            return
        }

        // 清理输入,移除首尾空格
        const cleanBaseUrl = baseUrl.trim()
        const cleanApiKey = apiKey.trim()

        setLoading(true)
        setTestResult(null)
        try {
            const params = new URLSearchParams({
                base_url: cleanBaseUrl,
                api_key: cleanApiKey
            })
            const response = await fetch(`/api/config/llm/models?${params}`)

            if (!response.ok) {
                // 安全地解析错误响应
                let errorMessage = '获取模型列表失败'
                try {
                    const contentType = response.headers.get('content-type')
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json()
                        errorMessage = errorData.detail || errorMessage
                    } else {
                        // 如果不是 JSON 响应,使用状态文本
                        const text = await response.text()
                        errorMessage = text || `HTTP ${response.status}: ${response.statusText}`
                    }
                } catch (parseError) {
                    // JSON 解析失败,使用状态码和状态文本
                    console.error('解析错误响应失败:', parseError)
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`
                }
                throw new Error(errorMessage)
            }

            const data = await response.json()

            if (data.models && data.models.length > 0) {
                const modelList = data.models
                setModels(modelList)
                // 保存模型列表到localStorage
                localStorage.setItem('aiModels', JSON.stringify(modelList))

                // 使用传入的currentModel或当前config.model
                const modelToCheck = currentModel !== null ? currentModel : config.model

                // 只在模型为空时,才自动选择第一个模型
                // 如果用户已经选择了模型,则保留用户的选择
                if (!modelToCheck || modelToCheck === '') {
                    setConfig(prev => ({ ...prev, model: modelList[0] }))
                }
            } else {
                throw new Error('API返回的模型列表为空,请检查API配置')
            }
        } catch (error) {
            console.error('获取模型列表失败:', error)
            // 提供更友好的错误提示
            const errorMsg = error.message || '未知错误'
            let userMessage = `获取模型列表失败: ${errorMsg}\n\n请检查:\n`

            if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
                userMessage += '1. 网络连接是否正常\n2. 后端服务是否启动\n3. Base URL 是否正确'
            } else if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('API key')) {
                userMessage += '1. API Key 是否正确\n2. API Key 是否有效\n3. API Key 权限是否足够'
            } else if (errorMsg.includes('404')) {
                userMessage += '1. Base URL 是否正确\n2. API 端点是否存在'
            } else {
                userMessage += '1. API Key 是否正确\n2. Base URL 是否正确\n3. 网络连接是否正常'
            }

            alert(userMessage)
            setModels([])
        } finally {
            setLoading(false)
        }
    }

    const handleTestConnection = async () => {
        if (!config.apiKey || !config.baseUrl || !config.model) {
            alert('请先填写完整的配置信息')
            return
        }

        setTesting(true)
        setTestResult(null)
        try {
            // 清理配置,移除首尾空格
            const cleanConfig = {
                baseUrl: config.baseUrl.trim(),
                apiKey: config.apiKey.trim(),
                model: config.model.trim(),
                systemPrompt: config.systemPrompt
            }

            const response = await fetch('/api/config/llm/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(cleanConfig)
            })
            const result = await response.json()
            setTestResult(result)

            if (result.success) {
                alert(`✅ ${result.message}\n响应: ${result.response}`)
            } else {
                alert(`❌ ${result.message}`)
            }
        } catch (error) {
            console.error('测试连接失败:', error)
            setTestResult({
                success: false,
                message: '测试失败: ' + error.message
            })
            alert('测试连接失败: ' + error.message)
        } finally {
            setTesting(false)
        }
    }

    const handleSave = () => {
        if (!config.apiKey || !config.model) {
            alert('请至少填写 API Key 和选择模型')
            return
        }

        // 清理配置,移除所有字符串字段的首尾空格
        const cleanConfig = {
            baseUrl: config.baseUrl.trim(),
            apiKey: config.apiKey.trim(),
            model: config.model.trim(),
            systemPrompt: config.systemPrompt  // systemPrompt 不 trim,保留格式
        }

        // 保存配置
        localStorage.setItem('aiConfig', JSON.stringify(cleanConfig))
        // 保存模型列表
        if (models.length > 0) {
            localStorage.setItem('aiModels', JSON.stringify(models))
        }

        alert(t('messages.success.config_saved'))
        onClose()
    }

    const maskApiKey = (key) => {
        if (!key || key.length < 8) return key
        return key.substring(0, 4) + '****' + key.substring(key.length - 4)
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content ai-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{t('modals.ai.title')}</h2>
                    <button className="modal-close" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>{t('modals.ai.base_url')}</label>
                        <input
                            type="text"
                            className="input"
                            value={config.baseUrl}
                            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                            placeholder="https://api.openai.com/v1"
                        />
                    </div>

                    <div className="form-group">
                        <label>{t('modals.ai.api_key')}</label>
                        <input
                            type="password"
                            className="input"
                            value={config.apiKey}
                            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                            placeholder="sk-xxxxxxxxxxxxx"
                        />
                        {config.apiKey && (
                            <div className="token-display">{maskApiKey(config.apiKey)}</div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>{t('modals.ai.model')}</label>
                        <div className="model-select-group">
                            <select
                                className="input"
                                value={config.model}
                                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                                disabled={models.length === 0}
                            >
                                {models.length === 0 ? (
                                    <option value="">请先获取模型列表</option>
                                ) : (
                                    <>
                                        {!config.model && <option value="">请选择模型</option>}
                                        {models.map(model => (
                                            <option key={model} value={model}>{model}</option>
                                        ))}
                                    </>
                                )}
                            </select>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleFetchModels()}
                                disabled={loading || !config.apiKey}
                            >
                                {loading ? '获取中...' : '获取模型'}
                            </button>
                        </div>
                        {models.length === 0 && (
                            <div className="hint-text">
                                💡 请先输入API Key和Base URL,然后点击"获取模型"按钮
                            </div>
                        )}
                        {models.length > 0 && (
                            <div className="model-count">
                                已加载 {models.length} 个模型
                            </div>
                        )}
                    </div>

                    {/* 测试连接按钮 */}
                    <div className="form-group">
                        <button
                            className="btn btn-primary test-connection-btn"
                            onClick={handleTestConnection}
                            disabled={testing || !config.apiKey || !config.model}
                        >
                            {testing ? '测试中...' : '🔌 测试连接'}
                        </button>
                        {testResult && (
                            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                                {testResult.success ? '✅' : '❌'} {testResult.message}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>{t('modals.ai.system_prompt')}</label>
                        <textarea
                            className="input prompt-textarea"
                            value={config.systemPrompt}
                            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                            rows={12}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        取消
                    </button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        {t('modals.ai.save')}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AIConfigModal
