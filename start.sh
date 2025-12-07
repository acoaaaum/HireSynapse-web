#!/bin/bash

echo "🚀 启动 HireSynapse Web 应用"
echo "================================"

# 检查是否在项目根目录
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ 错误:请在项目根目录运行此脚本"
    exit 1
fi

# 启动后端
echo ""
echo "📦 启动后端服务 (FastAPI)..."
cd backend

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "创建 Python 虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
if [ ! -f "venv/.installed" ]; then
    echo "安装 Python 依赖..."
    pip install -r requirements.txt
    touch venv/.installed
fi

# 启动后端(后台运行)
echo "启动 FastAPI 服务器 (http://localhost:8000)..."
python -m uvicorn app.main:app --reload &
BACKEND_PID=$!

cd ..

# 启动前端
echo ""
echo "🎨 启动前端服务 (Vite)..."
cd frontend

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi

# 启动前端
echo "启动 Vite 开发服务器 (http://localhost:3000)..."
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "✅ 应用启动成功!"
echo "================================"
echo "后端: http://localhost:8000"
echo "前端: http://localhost:3000"
echo "API 文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
