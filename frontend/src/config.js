// API配置
export const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// 如果没有配置VITE_API_URL,使用相对路径(本地开发)
// 如果配置了VITE_API_URL,使用完整URL(生产环境)
