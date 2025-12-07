# HireSynapse Web

<div align="center">

![HireSynapse Logo](frontend/public/log.svg)

**智能简历解析与管理系统**

一个基于AI的简历智能解析工具，支持批量处理、字典标准化和Notion集成

[English](#english) | [中文](#中文)

</div>

---

## 中文

### 📖 项目简介

HireSynapse Web 是一个强大的简历智能解析与管理系统，旨在帮助HR和招聘团队高效处理大量简历。通过AI技术自动提取简历信息，结合字典标准化功能确保数据一致性，并可直接导入到Notion数据库进行管理。

### ✨ 核心功能

#### 1. 智能简历解析
- 📄 **批量上传**: 支持同时上传多个PDF简历
- 🤖 **AI解析**: 使用大语言模型(LLM)自动提取简历信息
- 🎯 **字段提取**: 自动识别姓名、电话、邮箱、公司、职位、学历等关键信息
- 🔍 **重复检测**: 自动识别重复候选人，避免重复录入

#### 2. 字典标准化
- 🏢 **公司库**: 维护标准公司名称及其别名映射
- 🎓 **院校库**: 维护标准院校名称及其别名映射
- 🔄 **自动匹配**: AI识别的公司/院校名称自动匹配到标准名称
- ➕ **快速添加**: 在审阅时一键添加新的映射关系

#### 3. 数据审阅与编辑
- 📋 **分屏查看**: 左侧PDF预览，右侧表单编辑
- ✏️ **手动修正**: 可手动修改AI解析的任何字段
- 📊 **重复提示**: 检测到重复时显示已有记录，可选择覆盖更新
- 🔗 **快速跳转**: 直接跳转到Notion查看已有记录

#### 4. Notion集成
- 📤 **一键导入**: 批量导入已解析的简历到Notion数据库
- 🔄 **字段映射**: 灵活配置简历字段到Notion属性的映射关系
- 📎 **附件上传**: 可选择将PDF简历作为附件上传到Notion
- 🔁 **覆盖更新**: 重复候选人可选择更新已有记录

#### 5. 历史记录
- 💾 **本地存储**: 自动保存处理历史(最多200条)
- 🔍 **搜索筛选**: 按名称搜索，按状态筛选
- 📝 **重新审阅**: 可重新查看和编辑历史记录
- 🗑️ **批量清理**: 支持单个删除或清空全部历史

#### 6. 多语言支持
- 🌐 **中英文**: 完整的中英文界面切换
- 🔄 **实时切换**: 无需刷新页面即可切换语言
- 📢 **智能提示**: 所有操作都有清晰的多语言反馈

### 🛠️ 技术栈

#### 前端
- **框架**: React 18 + Vite
- **路由**: React Router v6
- **国际化**: i18next
- **PDF预览**: react-pdf
- **样式**: CSS Modules + CSS Variables

#### 后端
- **框架**: FastAPI (Python 3.9+)
- **PDF解析**: PyMuPDF
- **AI服务**: OpenAI API / Gemini API
- **数据处理**: Pandas
- **Notion集成**: Notion SDK

### 📦 安装部署

#### 前置要求
- Node.js 16+
- Python 3.9+
- OpenAI API Key 或 Gemini API Key
- Notion Integration Token (可选)

#### 1. 克隆项目
```bash
git clone <repository-url>
cd HireSynapse-web
```

#### 2. 后端配置

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的API密钥
```

**.env 配置说明**:
```env
# AI配置 (二选一)
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1

# 或使用 Gemini
GEMINI_API_KEY=your_gemini_api_key

# Notion配置 (可选)
NOTION_TOKEN=your_notion_integration_token
NOTION_DATABASE_ID=your_database_id
```

#### 3. 前端配置

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

#### 4. 启动应用

**方式一: 使用启动脚本** (推荐)
```bash
# 在项目根目录
chmod +x start.sh
./start.sh
```

**方式二: 手动启动**
```bash
# 终端1 - 启动后端
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 终端2 - 启动前端
cd frontend
npm run dev
```

访问 `http://localhost:5173` 即可使用应用。

### 📚 使用指南

#### 第一次使用

1. **配置AI设置**
   - 点击右下角"AI配置"按钮
   - 填入API Base URL、API Key、模型名称
   - 可自定义System Prompt (可选)
   - 点击"保存配置"

2. **配置Notion** (可选)
   - 点击右下角"Notion配置"按钮
   - 填入Integration Token
   - 选择目标数据库
   - 配置字段映射关系
   - 选择是否上传PDF附件
   - 点击"保存配置"

3. **配置字典** (可选)
   - 点击右下角"字典管理"按钮
   - 在"公司库"或"院校库"标签页添加标准名称和别名
   - 支持批量导入/导出JSON格式

#### 日常使用流程

1. **上传简历**
   - 拖拽或点击上传区域选择PDF文件
   - 支持批量上传多个文件
   - 文件会自动上传到后端

2. **开始解析**
   - 点击"开始解析"按钮
   - AI会自动提取所有简历的信息
   - 解析过程中会显示进度提示
   - 自动进行重复检测

3. **审阅与修正**
   - 点击"校对"按钮进入审阅页面
   - 左侧查看PDF原文，右侧编辑提取的信息
   - 如有错误可手动修改
   - 遇到不标准的公司/院校名称可点击"保存到字典"

4. **导入到Notion**
   - 返回主页面，点击"一键导入"
   - 所有已完成的简历会批量导入到Notion
   - 导入过程中会显示进度和结果统计
   - 重复的候选人会提示是否覆盖更新

5. **查看历史**
   - 点击右下角"历史记录"按钮
   - 可搜索、筛选历史记录
   - 可重新审阅或删除记录
   - 支持清空全部历史

### 🎯 高级功能

#### 字典标准化原理

系统维护两个字典:
- **公司字典**: `backend/data/dictionaries/companies.json`
- **院校字典**: `backend/data/dictionaries/universities.json`

每个条目包含:
```json
{
  "标准名称": {
    "standard": "标准名称",
    "aliases": ["别名1", "别名2", "标准名称"]
  }
}
```

当AI识别到公司/院校名称时:
1. 首先进行精确匹配(不区分大小写)
2. 然后进行模糊匹配(相似度>80%)
3. 匹配成功则替换为标准名称
4. 未匹配则保持原值

#### 重复检测机制

系统通过以下方式检测重复:
1. 在Notion数据库中搜索相同的手机号或邮箱
2. 如果找到匹配记录，标记为"重复"
3. 在审阅页面显示已有记录的链接
4. 可选择覆盖更新已有记录

#### 自定义System Prompt

可以自定义AI的解析指令，例如:
```
你是一个专业的简历解析助手。请从简历中提取以下信息，以JSON格式返回:
- name: 姓名
- phone: 手机号
- email: 邮箱
- current_company: 当前公司
- current_position: 当前职位
...

注意:
1. 如果某个字段找不到，返回空字符串
2. 公司名称尽量使用全称
3. 本科毕业时间格式为YYYY
```

### 🔧 配置文件说明

#### 后端配置
- `backend/.env` - 环境变量配置
- `backend/data/dictionaries/` - 字典数据目录
- `backend/uploads/` - 上传文件存储目录

#### 前端配置
- `frontend/src/i18n/locales/` - 国际化文本
- `localStorage` - 本地存储配置和历史记录
  - `aiConfig` - AI配置
  - `notionConfig` - Notion配置
  - `resume_history` - 简历历史记录

### 🐛 常见问题

#### 1. PDF显示乱码
- 确保使用了正确的CMap配置
- 系统已自动配置，通常不会出现此问题

#### 2. AI解析失败
- 检查API Key是否正确
- 检查网络连接
- 查看后端日志获取详细错误信息

#### 3. Notion导入失败
- 确认Integration Token有权限访问数据库
- 检查字段映射是否正确
- 确保数据库字段类型匹配

#### 4. 字典不生效
- 检查字典文件格式是否正确
- 确保别名列表包含标准名称本身
- 重新加载字典(刷新页面)

### 📝 开发说明

#### 项目结构
```
HireSynapse-web/
├── backend/                 # 后端代码
│   ├── app/
│   │   ├── api/            # API路由
│   │   ├── services/       # 业务逻辑
│   │   └── main.py         # 应用入口
│   ├── data/               # 数据文件
│   │   └── dictionaries/   # 字典数据
│   ├── uploads/            # 上传文件
│   └── requirements.txt    # Python依赖
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── components/     # React组件
│   │   ├── pages/          # 页面组件
│   │   ├── contexts/       # Context
│   │   └── i18n/           # 国际化
│   └── public/             # 静态资源
├── start.sh                # 启动脚本
└── README.md               # 本文件
```

#### 添加新功能
1. 后端: 在 `backend/app/api/` 添加新路由
2. 前端: 在 `frontend/src/pages/` 添加新页面
3. 国际化: 在 `frontend/src/i18n/locales/` 添加文本

### 📄 许可证

本项目仅供学习和个人使用。

### 🤝 贡献

欢迎提交Issue和Pull Request!

---

## English

### 📖 Introduction

HireSynapse Web is a powerful AI-powered resume parsing and management system designed to help HR teams and recruiters efficiently process large volumes of resumes. It automatically extracts resume information using AI technology, ensures data consistency through dictionary standardization, and can directly import data into Notion databases.

### ✨ Key Features

#### 1. Intelligent Resume Parsing
- 📄 **Batch Upload**: Upload multiple PDF resumes simultaneously
- 🤖 **AI Parsing**: Automatically extract resume information using LLM
- 🎯 **Field Extraction**: Auto-identify name, phone, email, company, position, education, etc.
- 🔍 **Duplicate Detection**: Automatically identify duplicate candidates

#### 2. Dictionary Standardization
- 🏢 **Company Dictionary**: Maintain standard company names and aliases
- 🎓 **University Dictionary**: Maintain standard university names and aliases
- 🔄 **Auto Matching**: AI-recognized names automatically match to standard names
- ➕ **Quick Add**: One-click add new mappings during review

#### 3. Data Review & Editing
- 📋 **Split View**: PDF preview on left, form editing on right
- ✏️ **Manual Correction**: Manually edit any AI-parsed field
- 📊 **Duplicate Alert**: Show existing records when duplicates detected
- 🔗 **Quick Jump**: Direct link to view existing Notion records

#### 4. Notion Integration
- 📤 **Batch Import**: Import all parsed resumes to Notion database
- 🔄 **Field Mapping**: Flexible configuration of field mappings
- 📎 **Attachment Upload**: Optional PDF resume upload to Notion
- 🔁 **Overwrite Update**: Option to update existing duplicate records

#### 5. History Records
- 💾 **Local Storage**: Auto-save processing history (max 200 records)
- 🔍 **Search & Filter**: Search by name, filter by status
- 📝 **Re-review**: View and edit historical records
- 🗑️ **Batch Cleanup**: Delete individual or clear all history

#### 6. Multi-language Support
- 🌐 **Chinese/English**: Complete bilingual interface
- 🔄 **Real-time Switch**: Switch language without page refresh
- 📢 **Smart Notifications**: Clear multilingual feedback for all operations

### 🛠️ Tech Stack

#### Frontend
- **Framework**: React 18 + Vite
- **Routing**: React Router v6
- **i18n**: i18next
- **PDF Preview**: react-pdf
- **Styling**: CSS Modules + CSS Variables

#### Backend
- **Framework**: FastAPI (Python 3.9+)
- **PDF Parsing**: PyMuPDF
- **AI Service**: OpenAI API / Gemini API
- **Data Processing**: Pandas
- **Notion Integration**: Notion SDK

### 📦 Installation

#### Prerequisites
- Node.js 16+
- Python 3.9+
- OpenAI API Key or Gemini API Key
- Notion Integration Token (optional)

#### Quick Start

1. **Clone Repository**
```bash
git clone <repository-url>
cd HireSynapse-web
```

2. **Backend Setup**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env file with your API keys
```

3. **Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

4. **Start Application**
```bash
# Use startup script (recommended)
chmod +x start.sh
./start.sh

# Or start manually
# Terminal 1: cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000
# Terminal 2: cd frontend && npm run dev
```

Visit `http://localhost:5173` to use the application.

### 📚 User Guide

Please refer to the Chinese section above for detailed usage instructions.

### 📝 Development

#### Project Structure
```
HireSynapse-web/
├── backend/                 # Backend code
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── services/       # Business logic
│   │   └── main.py         # App entry
│   ├── data/               # Data files
│   │   └── dictionaries/   # Dictionary data
│   ├── uploads/            # Uploaded files
│   └── requirements.txt    # Python dependencies
├── frontend/               # Frontend code
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # Contexts
│   │   └── i18n/           # Internationalization
│   └── public/             # Static assets
├── start.sh                # Startup script
└── README.md               # This file
```

### 📄 License

This project is for learning and personal use only.

### 🤝 Contributing

Issues and Pull Requests are welcome!

---

<div align="center">

Made with ❤️ by HireSynapse Team

</div>
