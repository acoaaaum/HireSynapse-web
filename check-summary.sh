#!/bin/bash

echo "======================================"
echo "简历总结功能诊断工具"
echo "======================================"
echo ""

echo "1. 检查后端代码是否已更新..."
if grep -q "DEBUG: generate_summary" backend/app/api/resumes.py; then
    echo "✅ 后端调试代码已添加"
else
    echo "❌ 后端调试代码未找到"
fi

echo ""
echo "2. 检查前端代码是否正确..."
if grep -q "generate_summary" frontend/src/pages/MainPage.jsx; then
    echo "✅ 前端总结参数已添加"
else
    echo "❌ 前端总结参数未找到"
fi

echo ""
echo "======================================"
echo "如何查看DEBUG信息:"
echo "======================================"
echo ""
echo "方法1: 查看运行 ./start.sh 的终端窗口"
echo "  - 找到运行应用的终端"
echo "  - 上传并解析简历后"
echo "  - 在终端中查找 'DEBUG:' 开头的行"
echo ""
echo "方法2: 在浏览器中检查配置"
echo "  1. 打开 http://localhost:3000"
echo "  2. 按 F12 打开开发者工具"
echo "  3. 切换到 Console 标签"
echo "  4. 输入并运行:"
echo "     localStorage.getItem('notionConfig')"
echo "  5. 查看 enableSummary 是否为 true"
echo ""
echo "======================================"
echo "常见问题排查:"
echo "======================================"
echo ""
echo "❓ 总结为空白?"
echo "  → 检查 Notion配置 中是否勾选了'启用AI简历总结'"
echo "  → 检查是否配置了 summary 字段映射"
echo ""
echo "❓ 如何启用总结功能?"
echo "  1. 点击右下角'Notion配置'"
echo "  2. 勾选'启用AI简历总结'"
echo "  3. (可选)修改总结提示词"
echo "  4. 在字段映射中配置'简历总结'字段"
echo "  5. 点击'保存配置'"
echo ""
