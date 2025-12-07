"""
字典管理 API 路由 (优化版)

新增功能:
1. 依赖注入
2. 统计分析
3. 搜索过滤
4. 质量检查
5. 备份管理
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from functools import lru_cache

from ..services.dictionary_service import DictionaryService

router = APIRouter(prefix="/api/dictionaries", tags=["dictionaries"])


# 依赖注入
@lru_cache()
def get_dict_service() -> DictionaryService:
    """获取字典服务单例"""
    return DictionaryService()


# Pydantic 模型
class DictEntry(BaseModel):
    """字典条目"""
    standard: str = Field(..., description="标准名称")
    aliases: List[str] = Field(..., description="别名列表")
    category: Optional[str] = Field(None, description="分类")
    location: Optional[str] = Field(None, description="位置")


class CompanyDict(BaseModel):
    """公司字典"""
    companies: Dict[str, DictEntry]


class UniversityDict(BaseModel):
    """院校字典"""
    universities: Dict[str, DictEntry]


class AddMappingRequest(BaseModel):
    """添加映射请求"""
    alias: str = Field(..., min_length=1, description="别名")
    standard: str = Field(..., min_length=1, description="标准名称")


# API 端点
@router.get("/company")
async def get_company_dict(
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """获取公司字典"""
    try:
        companies = dict_service.get_companies()
        return {"companies": companies}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/university")
async def get_university_dict(
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """获取院校字典"""
    try:
        universities = dict_service.get_universities()
        return {"universities": universities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/company")
async def update_company_dict(
    data: CompanyDict,
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """更新公司字典"""
    try:
        # 转换为内部格式
        companies = {
            standard: entry.dict(exclude_none=True)
            for standard, entry in data.companies.items()
        }
        dict_service.update_companies(companies)
        return {"success": True, "message": "公司字典已更新"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/university")
async def update_university_dict(
    data: UniversityDict,
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """更新院校字典"""
    try:
        # 转换为内部格式
        universities = {
            standard: entry.dict(exclude_none=True)
            for standard, entry in data.universities.items()
        }
        dict_service.update_universities(universities)
        return {"success": True, "message": "院校字典已更新"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/company/add")
async def add_company_mapping(
    request: AddMappingRequest,
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """添加公司映射"""
    try:
        dict_service.add_company_mapping(request.alias, request.standard)
        return {"success": True, "message": f"已添加映射: {request.alias} -> {request.standard}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/university/add")
async def add_university_mapping(
    request: AddMappingRequest,
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """添加院校映射"""
    try:
        dict_service.add_university_mapping(request.alias, request.standard)
        return {"success": True, "message": f"已添加映射: {request.alias} -> {request.standard}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics")
async def get_statistics(
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """获取字典统计信息"""
    try:
        stats = dict_service.get_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/company/search")
async def search_companies(
    query: str,
    limit: int = 10,
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """搜索公司"""
    try:
        results = dict_service.search_companies(query, limit)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/university/search")
async def search_universities(
    query: str,
    limit: int = 10,
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """搜索院校"""
    try:
        results = dict_service.search_universities(query, limit)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/validate")
async def validate_dictionary(
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """验证字典质量"""
    try:
        issues = dict_service.validate_dictionary()
        return {
            "valid": len(issues) == 0,
            "issues": issues
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/backups/{filename}")
async def list_backups(
    filename: str,
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """列出备份"""
    try:
        if filename not in ["companies.json", "universities.json"]:
            raise HTTPException(status_code=400, detail="无效的文件名")
        
        backups = dict_service.list_backups(filename)
        return {"backups": backups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rollback")
async def rollback_to_backup(
    filename: str,
    backup_timestamp: str,
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """回滚到指定备份"""
    try:
        if filename not in ["companies.json", "universities.json"]:
            raise HTTPException(status_code=400, detail="无效的文件名")
        
        dict_service.rollback_to_backup(filename, backup_timestamp)
        return {"success": True, "message": f"已回滚到备份: {backup_timestamp}"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
