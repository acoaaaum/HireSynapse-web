"""
配置管理 API 路由
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from ..services.llm_service import LLMService
from ..services.notion_service import NotionService

router = APIRouter(prefix="/api/config", tags=["config"])


class LLMConfig(BaseModel):
    baseUrl: str
    apiKey: str
    model: str
    systemPrompt: str


class NotionConfig(BaseModel):
    token: str
    databaseId: Optional[str] = None
    uploadAttachment: bool = True
    fieldMapping: Optional[dict] = None


@router.post("/llm")
async def save_llm_config(config: LLMConfig):
    """保存 LLM 配置"""
    # 实际应用中应该加密存储
    return {"success": True, "message": "配置已保存"}


@router.get("/llm")
async def get_llm_config():
    """获取 LLM 配置"""
    # 实际应用中从数据库读取
    return {
        "baseUrl": "https://api.openai.com/v1",
        "model": "gpt-4o-mini"
    }


@router.get("/llm/models")
async def get_available_models(base_url: str, api_key: str):
    """获取可用模型列表"""
    import traceback
    try:
        print(f"[DEBUG] 获取模型列表请求 - Base URL: {base_url}, API Key: {api_key[:10]}...")
        models = LLMService.get_available_models(base_url, api_key)
        print(f"[DEBUG] 成功获取 {len(models)} 个模型")
        return {"models": models}
    except Exception as e:
        # 打印详细的错误信息和堆栈跟踪
        error_msg = str(e)
        stack_trace = traceback.format_exc()
        print(f"[ERROR] 获取模型列表失败:")
        print(f"[ERROR] 错误类型: {type(e).__name__}")
        print(f"[ERROR] 错误信息: {error_msg}")
        print(f"[ERROR] 堆栈跟踪:\n{stack_trace}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/llm/test")
async def test_llm_connection(config: LLMConfig):
    """测试LLM连接"""
    try:
        result = LLMService.test_connection(
            base_url=config.baseUrl,
            api_key=config.apiKey,
            model=config.model
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/notion")
async def save_notion_config(config: NotionConfig):
    """保存 Notion 配置"""
    return {"success": True, "message": "配置已保存"}


@router.get("/notion/databases")
async def get_notion_databases(token: str):
    """获取 Notion 数据库列表"""
    try:
        notion_service = NotionService(token=token)
        databases = notion_service.get_databases()
        return {"databases": databases}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/notion/database/{database_id}/schema")
async def get_database_schema(database_id: str, token: str):
    """获取数据库字段结构"""
    try:
        notion_service = NotionService(token=token)
        schema = notion_service.get_database_schema(database_id)
        return {"schema": schema}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
