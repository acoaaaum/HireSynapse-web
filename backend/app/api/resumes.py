"""
简历处理 API 路由
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import FileResponse
from typing import List, Optional
from pathlib import Path
from urllib.parse import quote
import json
import os
import re

from ..services.pdf_parser import PDFParser
from ..services.llm_service import LLMService
from ..services.data_cleaner import DataCleaner
from ..services.notion_service import NotionService
from ..services.dictionary_service import DictionaryService

router = APIRouter(prefix="/api/resumes", tags=["resumes"])

# 初始化服务(实际应用中应使用依赖注入)
pdf_parser = PDFParser()
data_cleaner = DataCleaner()

# 使用依赖注入获取字典服务
from ..api.dictionaries import get_dict_service
from fastapi import Depends


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    """上传简历文件"""
    try:
        # 创建上传目录
        upload_dir = Path("uploads")
        upload_dir.mkdir(exist_ok=True)

        # 保存文件
        file_path = upload_dir / file.filename
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        return {"path": str(file_path), "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file/{file_path:path}")
async def get_resume_file(file_path: str):
    """
    获取简历PDF文件
    
    安全措施:
    1. 验证文件路径格式
    2. 检查文件是否存在
    3. 限制访问uploads目录
    """
    try:
        from urllib.parse import unquote
        
        # URL解码(处理中文文件名等)
        decoded_path = unquote(file_path)
        
        # 安全检查: 防止路径遍历攻击
        # 移除任何 ../ 或 ..\ 
        clean_path = decoded_path.replace('..', '').replace('\\', '/')
        
        # 确保路径在uploads目录下
        if not clean_path.startswith('uploads/'):
            clean_path = f'uploads/{clean_path}'
        
        full_path = Path(clean_path)
        
        # 验证文件存在
        if not full_path.exists() or not full_path.is_file():
            raise HTTPException(status_code=404, detail=f"File not found: {clean_path}")
        
        # 验证文件在uploads目录内(防止路径遍历)
        try:
            full_path.resolve().relative_to(Path('uploads').resolve())
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # 返回文件
        return FileResponse(
            full_path,
            media_type="application/pdf",
            headers={
                "Cache-Control": "private, max-age=3600",
                "Content-Disposition": f"inline; filename*=UTF-8''{quote(full_path.name)}"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error serving file: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear-history")
async def clear_history(request: dict):
    """清空历史记录,删除指定的文件"""
    try:
        file_paths = request.get("file_paths", [])
        deleted_count = 0
        failed_files = []
        
        for file_path in file_paths:
            try:
                # 安全检查: 只允许删除uploads目录下的文件
                if not file_path.startswith('uploads/'):
                    continue
                
                full_path = Path(file_path)
                if full_path.exists() and full_path.is_file():
                    full_path.unlink()
                    deleted_count += 1
            except Exception as e:
                print(f"删除文件失败: {file_path}, {e}")
                failed_files.append(file_path)
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "failed_files": failed_files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete-file/{file_path:path}")
async def delete_file(file_path: str):
    """删除单个文件"""
    try:
        from urllib.parse import unquote
        
        # URL解码
        decoded_path = unquote(file_path)
        
        # 安全检查
        if not decoded_path.startswith('uploads/'):
            decoded_path = f'uploads/{decoded_path}'
        
        full_path = Path(decoded_path)
        
        # 验证文件在uploads目录内
        try:
            full_path.resolve().relative_to(Path('uploads').resolve())
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied")
        
        if full_path.exists() and full_path.is_file():
            full_path.unlink()
            return {"success": True, "message": "File deleted"}
        else:
            raise HTTPException(status_code=404, detail="File not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse")
async def parse_resume(
    file_path: str = Form(...),
    ai_config: str = Form(...),
    generate_summary: bool = Form(False),
    summary_prompt: str = Form(None),
    dict_service: DictionaryService = Depends(get_dict_service)
):
    """解析简历"""
    try:
        # 解析 AI 配置
        config = json.loads(ai_config)
        
        # 初始化 LLM 服务
        llm_service = LLMService(
            base_url=config.get("baseUrl"),
            api_key=config.get("apiKey"),
            model=config.get("model"),
            system_prompt=config.get("systemPrompt")
        )
        
        # 解析 PDF
        text, mode = pdf_parser.parse(file_path)
        
        # 调用 LLM 解析
        if mode == 'text':
            parsed_data = llm_service.parse_resume_text(text)
        else:
            parsed_data = llm_service.parse_resume_image(text)
        
        # 数据清洗
        if parsed_data.get("current_company"):
            parsed_data["current_company"] = dict_service.normalize_company(
                parsed_data["current_company"]
            )
        
        if parsed_data.get("university"):
            parsed_data["university"] = dict_service.normalize_university(
                parsed_data["university"]
            )
        
        if parsed_data.get("phone"):
            parsed_data["phone"] = data_cleaner.clean_phone(parsed_data["phone"])
        
        if parsed_data.get("location"):
            parsed_data["location"] = data_cleaner.clean_location(parsed_data["location"])
        
        # 生成简历总结(如果启用)
        if generate_summary:
            try:
                summary = llm_service.generate_resume_summary(text, summary_prompt)
                parsed_data["summary"] = summary
            except Exception as e:
                print(f"生成简历总结失败: {e}")
                import traceback
                traceback.print_exc()
                # 总结生成失败不影响主流程,只记录错误
                parsed_data["summary"] = ""
        
        return {
            "success": True,
            "data": parsed_data,
            "mode": mode,
            "raw_text": text  # 返回原始文本供前端使用
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check-duplicate")
async def check_duplicate(
    database_id: str = Form(...),
    notion_token: str = Form(...),
    phone: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    field_mapping: Optional[str] = Form(None)
):
    """检查重复"""
    try:
        import json
        
        notion_service = NotionService(token=notion_token)
        
        # 解析字段映射
        mapping = json.loads(field_mapping) if field_mapping else {}
        
        result = notion_service.check_duplicate(
            database_id=database_id,
            phone=phone,
            email=email,
            field_mapping=mapping
        )
        
        return {
            "duplicate": result is not None,
            "data": result
        }
    except Exception as e:
        print(f"查重API错误: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save-to-notion")
async def save_to_notion(
    database_id: str = Form(...),
    notion_token: str = Form(...),
    data: str = Form(...),
    field_mapping: str = Form(...),
    pdf_file_path: str = Form(None),
    attachment_field: str = Form(None),
    pdf_text_content: str = Form(None),
    embed_pdf_content: bool = Form(False)
):
    """保存简历到 Notion"""
    try:
        import json
        
        # 解析数据
        resume_data = json.loads(data)
        mapping = json.loads(field_mapping)
        
        # 初始化 Notion 服务
        notion_service = NotionService(notion_token)
        
        # 格式化属性 - 传入database_id
        properties = notion_service.format_properties(
            data=resume_data,
            field_mapping=mapping,
            database_id=database_id
        )
        
        # 创建页面
        page = notion_service.create_page(
            database_id=database_id,
            properties=properties,
            pdf_file_path=Path(pdf_file_path) if pdf_file_path else None,
            attachment_field=attachment_field,
            pdf_text_content=pdf_text_content,
            embed_pdf_content=embed_pdf_content
        )
        
        return page
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-notion")
async def update_notion(
    page_id: str = Form(...),
    notion_token: str = Form(...),
    data: str = Form(...),
    field_mapping: str = Form(...),
    pdf_file_path: str = Form(None),
    attachment_field: str = Form(None),
    pdf_text_content: str = Form(None),
    embed_pdf_content: bool = Form(False)
):
    """更新 Notion 页面"""
    try:
        import json
        import os # Added import for os
        
        notion_service = NotionService(token=notion_token)
        
        # 解析数据
        resume_data = json.loads(data)
        mapping = json.loads(field_mapping)
        
        # 格式化属性
        properties = notion_service.format_properties(
            data=resume_data,
            field_mapping=mapping,
            database_id=""  # update时不需要database_id来format
        )
        
        # 处理文件路径
        full_path = None
        if pdf_file_path:
            # Assuming UPLOAD_DIR is defined globally or imported
            full_path = os.path.join(UPLOAD_DIR, pdf_file_path)
        
        # 更新页面
        page = notion_service.update_page(
            page_id=page_id,
            properties=properties,
            pdf_file_path=full_path if pdf_file_path else None,
            attachment_field=attachment_field,
            pdf_text_content=pdf_text_content,
            embed_pdf_content=embed_pdf_content
        )
        
        return page # Changed 'result' to 'page' for consistency with the new code
        
    except Exception as e:
        print(f"更新Notion页面错误: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
