"""
Notion API 集成服务
"""
from notion_client import Client
from typing import Dict, List, Any, Optional
import requests
from pathlib import Path


class NotionService:
    def __init__(self, token: str):
        self.client = Client(auth=token)
        self.token = token
    
    def get_databases(self) -> List[Dict[str, Any]]:
        """
        获取可访问的数据库列表
        
        Returns:
            List[Dict]: 数据库列表,每个包含 id 和 title
        """
        try:
            # 搜索所有数据库
            response = self.client.search(filter={"property": "object", "value": "database"})
            
            databases = []
            for db in response.get("results", []):
                db_id = db.get("id")
                title_prop = db.get("title", [])
                title = title_prop[0].get("plain_text", "Untitled") if title_prop else "Untitled"
                
                databases.append({
                    "id": db_id,
                    "title": title
                })
            
            return databases
            
        except Exception as e:
            print(f"获取数据库列表失败: {e}")
            raise
    
    def get_database_schema(self, database_id: str) -> Dict[str, Any]:
        """
        获取数据库的字段结构
        
        Args:
            database_id: 数据库 ID
            
        Returns:
            Dict: 字段结构信息
        """
        try:
            database = self.client.databases.retrieve(database_id=database_id)
            properties = database.get("properties", {})
            
            schema = {}
            for prop_name, prop_data in properties.items():
                schema[prop_name] = {
                    "type": prop_data.get("type"),
                    "id": prop_data.get("id")
                }
            
            return schema
            
        except Exception as e:
            print(f"获取数据库结构失败: {e}")
            raise
    
    def check_duplicate(
        self, 
        database_id: str, 
        phone: str = None, 
        email: str = None,
        field_mapping: Dict[str, str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        检查是否存在重复候选人
        
        Args:
            database_id: 数据库 ID
            phone: 电话号码
            email: 邮箱地址
            field_mapping: 字段映射 {标准字段名: Notion字段名}
            
        Returns:
            Optional[Dict]: 如果找到重复,返回页面信息,否则返回 None
        """
        try:
            if not phone and not email:
                print("查重: 没有提供电话或邮箱,跳过查重")
                return None
            
            # 获取数据库schema以确定字段类型
            schema = self.get_database_schema(database_id)
            
            filters = []
            
            # 使用字段映射查找实际的Notion字段名
            if phone and field_mapping:
                # 查找phone字段的映射
                phone_field = field_mapping.get('phone')
                if phone_field and phone_field in schema:
                    field_type = schema[phone_field].get('type')
                    if field_type == 'phone_number':
                        filters.append({
                            "property": phone_field,
                            "phone_number": {"equals": phone}
                        })
                        print(f"查重: 添加电话过滤器 - 字段: {phone_field}, 值: {phone}")
                    else:
                        print(f"警告: 字段 {phone_field} 类型是 {field_type}, 不是 phone_number")
                else:
                    print(f"警告: 未找到phone字段映射或字段不存在于数据库")
            
            if email and field_mapping:
                # 查找email字段的映射
                email_field = field_mapping.get('email')
                if email_field and email_field in schema:
                    field_type = schema[email_field].get('type')
                    if field_type == 'email':
                        filters.append({
                            "property": email_field,
                            "email": {"equals": email}
                        })
                        print(f"查重: 添加邮箱过滤器 - 字段: {email_field}, 值: {email}")
                    else:
                        print(f"警告: 字段 {email_field} 类型是 {field_type}, 不是 email")
                else:
                    print(f"警告: 未找到email字段映射或字段不存在于数据库")
            
            if not filters:
                print("查重: 没有有效的过滤条件")
                return None
            
            # 使用 OR 条件查询
            filter_query = {
                "or": filters
            } if len(filters) > 1 else filters[0]
            
            print(f"查重: 执行查询 - {filter_query}")
            
            response = self.client.databases.query(
                database_id=database_id,
                filter=filter_query
            )
            
            results = response.get("results", [])
            print(f"查重: 找到 {len(results)} 条匹配记录")
            
            if results:
                page = results[0]
                duplicate_info = {
                    "id": page.get("id"),
                    "url": page.get("url"),
                    "exists": True
                }
                print(f"查重: 发现重复 - {duplicate_info}")
                return duplicate_info
            
            print("查重: 未发现重复")
            return None
            
        except Exception as e:
            print(f"去重检查失败: {e}")
            import traceback
            traceback.print_exc()
            return {"duplicate": False}
    
    @staticmethod
    def _split_text_into_chunks(text: str, chunk_size: int = 2000) -> list:
        """
        将长文本分割为多个块
        
        Args:
            text: 要分割的文本
            chunk_size: 每块的最大字符数
            
        Returns:
            List[文本块]
        """
        if not text:
            return []
        
        chunks = []
        for i in range(0, len(text), chunk_size):
            chunks.append(text[i:i + chunk_size])
        return chunks
    
    def create_page(
        self,
        database_id: str,
        properties: Dict[str, Any],
        pdf_file_path: Optional[str] = None,
        attachment_field: Optional[str] = None,
        pdf_text_content: Optional[str] = None,
        embed_pdf_content: bool = False
    ) -> Dict[str, Any]:
        """
        创建 Notion 页面
        
        Args:
            database_id: 数据库 ID
            properties: 页面属性
            pdf_file_path: PDF 文件路径(可选)
            attachment_field: 指定的Files字段名(可选)
            
        Returns:
            Dict: 创建的页面信息
        """
        try:
            # 如果提供了PDF文件,先上传并添加到Files属性
            file_upload_id = None
            if pdf_file_path and Path(pdf_file_path).exists():
                file_path = Path(pdf_file_path)
                
                # 创建File Upload并上传文件
                file_upload_id = self._create_file_upload(file_path)
                if file_upload_id:
                    success = self._send_file_content(file_upload_id, file_path)
                    if success:
                        # 添加到Files属性,传递attachment_field
                        properties = self.add_file_to_property(
                            properties=properties,
                            file_upload_id=file_upload_id,
                            filename=file_path.name,
                            database_id=database_id,
                            attachment_field=attachment_field
                        )
            
            # 创建页面
            page = self.client.pages.create(
                parent={"database_id": database_id},
                properties=properties
            )
            
            page_id = page.get("id")
            
            # 准备要添加的内容块
            children_blocks = []
            
            # 如果有file_upload_id,添加PDF块到页面正文
            if file_upload_id and pdf_file_path:
                children_blocks.append({
                    "object": "block",
                    "type": "pdf",
                    "pdf": {
                        "type": "file_upload",
                        "file_upload": {
                            "id": file_upload_id
                        }
                    }
                })
            
            # 如果启用了PDF内容嵌入,添加文本内容代码块
            if embed_pdf_content and pdf_text_content:
                try:
                    # 添加标题
                    children_blocks.append({
                        "object": "block",
                        "type": "heading_2",
                        "heading_2": {
                            "rich_text": [{
                                "type": "text",
                                "text": {"content": "简历原始内容"}
                            }]
                        }
                    })
                    
                    # 分块处理文本(Notion限制每个text块2000字符)
                    text_chunks = self._split_text_into_chunks(pdf_text_content, 2000)
                    
                    for chunk in text_chunks:
                        children_blocks.append({
                            "object": "block",
                            "type": "code",
                            "code": {
                                "rich_text": [{
                                    "type": "text",
                                    "text": {"content": chunk}
                                }],
                                "language": "latex"
                            }
                        })
                    
                    print(f"✅ PDF文本内容已添加({len(text_chunks)}个代码块)")
                except Exception as e:
                    print(f"添加PDF文本内容失败: {e}")
            
            # 一次性添加所有块
            if children_blocks:
                try:
                    self.client.blocks.children.append(
                        block_id=page_id,
                        children=children_blocks
                    )
                    if file_upload_id:
                        print(f"✅ PDF已嵌入到页面正文")
                except Exception as e:
                    print(f"添加内容块失败: {e}")
            
            return {
                "id": page_id,
                "url": page.get("url"),
                "success": True
            }
            
        except Exception as e:
            print(f"创建页面失败: {e}")
            raise
    
    def update_page(
        self,
        page_id: str,
        properties: Dict[str, Any],
        pdf_file_path: Optional[str] = None,
        attachment_field: Optional[str] = None,
        pdf_text_content: Optional[str] = None,
        embed_pdf_content: bool = False
    ) -> Dict[str, Any]:
        """
        更新 Notion 页面
        
        Args:
            page_id: 页面 ID
            properties: 页面属性
            pdf_file_path: PDF 文件路径(可选)
            attachment_field: 指定的Files字段名(可选)
            
        Returns:
            Dict: 更新的页面信息
        """
        try:
            # 如果提供了PDF文件,先上传并添加到Files属性
            file_upload_id = None
            if pdf_file_path and Path(pdf_file_path).exists():
                file_path = Path(pdf_file_path)
                
                # 创建File Upload并上传文件
                file_upload_id = self._create_file_upload(file_path)
                if file_upload_id:
                    success = self._send_file_content(file_upload_id, file_path)
                    if success and attachment_field:
                        # 添加到Files属性
                        # 注意: 更新时需要获取数据库ID
                        # 从页面信息中获取
                        page_info = self.client.pages.retrieve(page_id=page_id)
                        database_id = page_info.get("parent", {}).get("database_id")
                        
                        if database_id:
                            properties = self.add_file_to_property(
                                properties=properties,
                                file_upload_id=file_upload_id,
                                filename=file_path.name,
                                database_id=database_id,
                                attachment_field=attachment_field
                            )
            
            # 更新页面属性
            page = self.client.pages.update(
                page_id=page_id,
                properties=properties
            )
            
            # 准备要添加的内容块
            children_blocks = []
            
            # 如果有file_upload_id,添加PDF块到页面正文
            if file_upload_id and pdf_file_path:
                children_blocks.append({
                    "object": "block",
                    "type": "pdf",
                    "pdf": {
                        "type": "file_upload",
                        "file_upload": {
                            "id": file_upload_id
                        }
                    }
                })
            
            # 如果启用了PDF内容嵌入,添加文本内容代码块
            if embed_pdf_content and pdf_text_content:
                try:
                    # 添加标题
                    children_blocks.append({
                        "object": "block",
                        "type": "heading_2",
                        "heading_2": {
                            "rich_text": [{
                                "type": "text",
                                "text": {"content": "简历原始内容"}
                            }]
                        }
                    })
                    
                    # 分块处理文本
                    text_chunks = self._split_text_into_chunks(pdf_text_content, 2000)
                    
                    for chunk in text_chunks:
                        children_blocks.append({
                            "object": "block",
                            "type": "code",
                            "code": {
                                "rich_text": [{
                                    "type": "text",
                                    "text": {"content": chunk}
                                }],
                                "language": "latex"
                            }
                        })
                    
                    print(f"✅ PDF文本内容已添加({len(text_chunks)}个代码块)")
                except Exception as e:
                    print(f"添加PDF文本内容失败: {e}")
            
            # 一次性添加所有块
            if children_blocks:
                try:
                    self.client.blocks.children.append(
                        block_id=page_id,
                        children=children_blocks
                    )
                    if file_upload_id:
                        print(f"✅ PDF已嵌入到页面正文")
                except Exception as e:
                    print(f"添加内容块失败: {e}")
            
            print(f"✅ 页面已更新: {page_id}")
            return {
                "id": page_id,
                "url": page.get("url"),
                "success": True
            }
            
        except Exception as e:
            print(f"更新页面失败: {e}")
            raise
    
    
    def _create_file_upload(self, file_path: Path) -> Optional[str]:
        """
        创建File Upload对象
        
        Args:
            file_path: 文件路径
            
        Returns:
            file_upload_id 或 None
        """
        try:
            import requests
            
            file_size = file_path.stat().st_size
            filename = file_path.name
            
            # 创建File Upload
            response = requests.post(
                "https://api.notion.com/v1/file_uploads",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Notion-Version": "2022-06-28",
                    "Content-Type": "application/json"
                },
                json={
                    "mode": "single_part",  # <5MB使用single_part
                    "filename": filename,
                    "content_type": "application/pdf"
                }
            )
            
            if response.status_code != 200:
                print(f"创建File Upload失败: {response.text}")
                return None
            
            data = response.json()
            file_upload_id = data.get("id")
            self._upload_url = data.get("upload_url")  # 保存upload_url
            
            print(f"File Upload已创建: {file_upload_id}")
            return file_upload_id
            
        except Exception as e:
            print(f"创建File Upload异常: {e}")
            return None
    
    def _send_file_content(self, file_upload_id: str, file_path: Path) -> bool:
        """
        发送文件内容到File Upload
        
        Args:
            file_upload_id: File Upload ID
            file_path: 文件路径
            
        Returns:
            是否成功
        """
        try:
            import requests
            
            if not hasattr(self, '_upload_url') or not self._upload_url:
                print("缺少upload_url")
                return False
            
            # 读取文件
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            # 上传文件内容
            response = requests.post(
                self._upload_url,
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Notion-Version": "2022-06-28"
                },
                files={
                    "file": (file_path.name, file_data, "application/pdf")
                }
            )
            
            if response.status_code not in [200, 201, 204]:
                print(f"上传文件内容失败: {response.status_code} {response.text}")
                return False
            
            print(f"✅ 文件内容已上传: {file_path.name}")
            return True
            
        except Exception as e:
            print(f"上传文件内容异常: {e}")
            return False
    
    def add_file_to_property(
        self,
        properties: Dict[str, Any],
        file_upload_id: str,
        filename: str,
        database_id: str,
        attachment_field: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        将文件添加到Files属性
        
        Args:
            properties: 现有属性字典
            file_upload_id: File Upload ID
            filename: 文件名
            database_id: 数据库ID
            attachment_field: 指定的Files字段名(可选,如果不指定则自动识别)
            
        Returns:
            更新后的properties
        """
        try:
            # 获取数据库schema
            schema = self.get_database_schema(database_id)
            
            # 确定使用哪个Files字段
            files_field = None
            
            if attachment_field:
                # 使用用户指定的字段
                if attachment_field in schema and schema[attachment_field].get("type") == "files":
                    files_field = attachment_field
                else:
                    print(f"警告: 指定的字段 '{attachment_field}' 不是Files类型")
            
            # 如果没有指定或指定的字段无效,自动查找第一个Files字段
            if not files_field:
                for field_name, field_info in schema.items():
                    if field_info.get("type") == "files":
                        files_field = field_name
                        break
            
            if not files_field:
                print("警告: 数据库中没有Files类型字段,跳过文件属性上传")
                return properties
            
            # 添加文件到Files属性
            properties[files_field] = {
                "files": [{
                    "type": "file_upload",
                    "file_upload": {
                        "id": file_upload_id
                    },
                    "name": filename
                }]
            }
            
            print(f"✅ 文件已添加到属性 '{files_field}': {filename}")
            return properties
            
        except Exception as e:
            print(f"添加文件到属性失败: {e}")
            return properties
    
    def format_properties(
        self, 
        data: Dict[str, Any], 
        field_mapping: Dict[str, str],
        database_id: str
    ) -> Dict[str, Any]:
        """
        将数据格式化为 Notion 属性格式,根据数据库schema动态适配
        
        Args:
            data: 原始数据
            field_mapping: 字段映射 {标准字段名: Notion字段名}
            database_id: 数据库ID,用于获取schema
            
        Returns:
            Dict: Notion 属性格式
        """
        # 获取数据库schema
        schema = self.get_database_schema(database_id)
        properties = {}
        
        for standard_field, notion_field in field_mapping.items():
            value = data.get(standard_field)
            if not value:
                continue
            
            # 获取Notion字段的实际类型
            field_info = schema.get(notion_field)
            if not field_info:
                print(f"警告: 字段 {notion_field} 不存在于数据库中")
                continue
            
            field_type = field_info.get("type")
            
            # 根据实际字段类型格式化
            if field_type == "title":
                properties[notion_field] = {
                    "title": [{"text": {"content": str(value)}}]
                }
            elif field_type == "rich_text":
                properties[notion_field] = {
                    "rich_text": [{"text": {"content": str(value)}}]
                }
            elif field_type == "phone_number":
                properties[notion_field] = {
                    "phone_number": str(value)
                }
            elif field_type == "email":
                properties[notion_field] = {
                    "email": str(value)
                }
            elif field_type == "select":
                # Select类型需要name属性
                properties[notion_field] = {
                    "select": {"name": str(value)}
                }
            elif field_type == "multi_select":
                # Multi-select类型
                properties[notion_field] = {
                    "multi_select": [{"name": str(value)}]
                }
            elif field_type == "number":
                try:
                    properties[notion_field] = {
                        "number": float(value)
                    }
                except:
                    print(f"警告: 无法将 {value} 转换为数字")
            elif field_type == "date":
                # 日期类型
                try:
                    # 如果是年份,转换为日期
                    if len(str(value)) == 4:
                        properties[notion_field] = {
                            "date": {"start": f"{value}-01-01"}
                        }
                    else:
                        properties[notion_field] = {
                            "date": {"start": str(value)}
                        }
                except:
                    print(f"警告: 无法将 {value} 转换为日期")
            elif field_type == "url":
                properties[notion_field] = {
                    "url": str(value)
                }
            elif field_type == "checkbox":
                properties[notion_field] = {
                    "checkbox": bool(value)
                }
            else:
                # 未知类型,默认使用rich_text
                print(f"警告: 未知字段类型 {field_type},使用 rich_text")
                properties[notion_field] = {
                    "rich_text": [{"text": {"content": str(value)}}]
                }
        
        return properties
