from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# 导入路由
from .api import resumes, config, dictionaries

app = FastAPI(
    title="HireSynapse API",
    description="智能简历解析系统后端 API",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(resumes.router)
app.include_router(config.router)
app.include_router(dictionaries.router)

# 创建上传目录
os.makedirs("uploads", exist_ok=True)

@app.get("/")
async def root():
    return {"message": "HireSynapse API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
