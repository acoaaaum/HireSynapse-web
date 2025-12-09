"""
LLM 服务 - 支持 OpenAI 和 Gemini API
"""
import openai
import google.generativeai as genai
from typing import Dict, Any, Optional, List
import json
import httpx


class LLMService:
    def __init__(self, base_url: str, api_key: str, model: str, system_prompt: str):
        self.base_url = base_url
        self.api_key = api_key
        self.model = model
        self.system_prompt = system_prompt
        
        # 判断使用哪个 API
        self.is_gemini = 'gemini' in model.lower()
        
        if self.is_gemini:
            genai.configure(api_key=api_key)
            self.client = genai.GenerativeModel(model)
        else:
            # 创建自定义httpx客户端,增加超时时间
            http_client = httpx.Client(timeout=60.0)  # 增加到60秒
            self.client = openai.OpenAI(
                api_key=api_key,
                base_url=base_url,
                http_client=http_client,
                timeout=60.0  # 设置OpenAI客户端超时
            )
    
    def parse_resume_text(self, text: str) -> Dict[str, Any]:
        """
        解析简历文本
        
        Args:
            text: 简历文本内容
            
        Returns:
            Dict: 解析后的结构化数据
        """
        if self.is_gemini:
            return self._parse_with_gemini_text(text)
        else:
            return self._parse_with_openai_text(text)
    
    def parse_resume_image(self, image_base64: str) -> Dict[str, Any]:
        """
        解析简历图片
        
        Args:
            image_base64: base64 编码的图片数据
            
        Returns:
            Dict: 解析后的结构化数据
        """
        if self.is_gemini:
            return self._parse_with_gemini_image(image_base64)
        else:
            return self._parse_with_openai_image(image_base64)
    
    def _parse_with_openai_text(self, text: str) -> Dict[str, Any]:
        """使用 OpenAI API 解析文本"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"请解析以下简历:\n\n{text}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
            
        except Exception as e:
            print(f"OpenAI 解析失败: {e}")
            raise
    
    def _parse_with_openai_image(self, image_base64: str) -> Dict[str, Any]:
        """使用 OpenAI Vision API 解析图片"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "请解析这份简历图片:"},
                            {"type": "image_url", "image_url": {"url": image_base64}}
                        ]
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
            
        except Exception as e:
            print(f"OpenAI Vision 解析失败: {e}")
            raise
    
    def _parse_with_gemini_text(self, text: str) -> Dict[str, Any]:
        """使用 Gemini API 解析文本"""
        try:
            prompt = f"{self.system_prompt}\n\n请解析以下简历:\n\n{text}"
            response = self.client.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    response_mime_type="application/json"
                )
            )
            
            result = json.loads(response.text)
            return result
            
        except Exception as e:
            print(f"Gemini 解析失败: {e}")
            raise
    
    def _parse_with_gemini_image(self, image_base64: str) -> Dict[str, Any]:
        """使用 Gemini Vision API 解析图片"""
        try:
            # 移除 data URL 前缀
            if ',' in image_base64:
                image_base64 = image_base64.split(',')[1]
            
            import base64
            image_data = base64.b64decode(image_base64)
            
            # 创建图片部分
            image_part = {
                "mime_type": "image/jpeg",
                "data": image_data
            }
            
            prompt = f"{self.system_prompt}\n\n请解析这份简历图片:"
            
            response = self.client.generate_content(
                [prompt, image_part],
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    response_mime_type="application/json"
                )
            )
            
            result = json.loads(response.text)
            return result
            
        except Exception as e:
            print(f"Gemini Vision 解析失败: {e}")
            raise
    
    def generate_resume_summary(self, text: str, summary_prompt: str = None) -> str:
        """
        生成简历总结
        
        Args:
            text: 简历原文
            summary_prompt: 自定义总结提示词,如果为None则使用默认提示词
            
        Returns:
            str: 中文总结内容
        """
        # 使用默认提示词或自定义提示词
        if not summary_prompt:
            summary_prompt = self._get_default_summary_prompt()
        
        # 截断过长的文本(保留前8000字符)
        if len(text) > 8000:
            text = text[:8000] + "..."
        
        if self.is_gemini:
            return self._generate_summary_with_gemini(text, summary_prompt)
        else:
            return self._generate_summary_with_openai(text, summary_prompt)
    
    def _get_default_summary_prompt(self) -> str:
        """获取默认的总结提示词"""
        return """请基于以下简历内容,生成一份专业的中文总结。

要求:
1. 总结候选人的主要研究方向或专业领域
2. 概括核心工作内容和项目经验
3. 列出主要技术栈和技能
4. 分析可能适合的职位类型
5. 分段输出,每段有明确主题
6. 突出重点,避免冗余
7. 不要重复联系方式、姓名等基础信息

输出格式:
## 专业领域
[内容]

## 工作经验
[内容]

## 技术栈
[内容]

## 适合职位
[内容]"""
    
    def _generate_summary_with_openai(self, text: str, summary_prompt: str) -> str:
        """使用 OpenAI API 生成总结"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": summary_prompt},
                    {"role": "user", "content": f"请总结以下简历:\n\n{text}"}
                ],
                temperature=0.3,
                max_tokens=1000,
                timeout=60.0  # 明确设置超时
            )
            
            return response.choices[0].message.content.strip()
            
        except openai.APITimeoutError as e:
            print(f"OpenAI API超时: {e}")
            return "⚠️ 总结生成超时,简历内容较长,请手动审阅"
        except openai.APIError as e:
            print(f"OpenAI API错误: {e}")
            return f"⚠️ API调用失败: {str(e)[:100]}"
        except Exception as e:
            print(f"OpenAI 生成总结失败: {e}")
            return f"⚠️ 总结生成失败,请手动审阅"
    
    def _generate_summary_with_gemini(self, text: str, summary_prompt: str) -> str:
        """使用 Gemini API 生成总结"""
        try:
            prompt = f"{summary_prompt}\n\n请总结以下简历:\n\n{text}"
            response = self.client.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=1000
                )
            )
            
            # 检查响应是否被安全过滤器拦截
            if not response.candidates:
                print(f"Gemini 安全过滤: 响应被完全拦截")
                return "⚠️ 简历内容因安全策略无法生成总结,请手动审阅"
            
            candidate = response.candidates[0]
            
            # 检查是否有安全评级问题
            if hasattr(candidate, 'safety_ratings') and candidate.safety_ratings:
                blocked = False
                for rating in candidate.safety_ratings:
                    if hasattr(rating, 'blocked') and rating.blocked:
                        blocked = True
                        print(f"Gemini 安全过滤: {rating.category} - {rating.probability}")
                
                if blocked:
                    return "⚠️ 简历内容触发安全过滤,无法生成总结,请手动审阅"
            
            # 检查finish_reason
            if hasattr(candidate, 'finish_reason'):
                if candidate.finish_reason == 3:  # SAFETY
                    print(f"Gemini 安全过滤: finish_reason = SAFETY")
                    return "⚠️ 简历内容因安全原因无法生成总结,请手动审阅"
            
            # 尝试获取文本内容
            if hasattr(candidate.content, 'parts') and candidate.content.parts:
                text_content = ''.join(part.text for part in candidate.content.parts if hasattr(part, 'text'))
                if text_content:
                    return text_content.strip()
            
            # 如果以上都失败,返回降级信息
            print(f"Gemini 响应无有效内容")
            return "⚠️ 无法生成总结,请手动审阅简历"
            
        except Exception as e:
            print(f"Gemini 生成总结失败: {e}")
            # 返回降级信息而不是抛出异常
            return f"⚠️ 总结生成失败: {str(e)[:100]}"
    
    @staticmethod
    def get_available_models(base_url: str, api_key: str) -> List[str]:
        """
        获取可用的模型列表 - 完全从API获取,不使用预设列表
        """
        try:
            # 判断是否是Gemini API
            is_gemini = 'generativelanguage.googleapis.com' in base_url or 'gemini' in base_url.lower()
            
            if is_gemini:
                # Gemini API - 通过API获取模型列表
                try:
                    genai.configure(api_key=api_key)
                    models = genai.list_models()
                    model_names = [
                        model.name.replace('models/', '') 
                        for model in models 
                        if 'generateContent' in model.supported_generation_methods
                    ]
                    return sorted(model_names) if model_names else []
                except Exception as gemini_error:
                    print(f"Gemini API调用失败: {gemini_error}")
                    raise Exception(f"无法获取Gemini模型列表: {str(gemini_error)}")
            else:
                # OpenAI API - 获取真实模型列表
                try:
                    # 创建自定义httpx客户端
                    http_client = httpx.Client(timeout=10.0)
                    client = openai.OpenAI(
                        api_key=api_key,
                        base_url=base_url,
                        http_client=http_client
                    )
                    models = client.models.list()
                    model_ids = [model.id for model in models.data]
                    
                    if not model_ids:
                        raise Exception("API返回的模型列表为空")
                    
                    # 返回所有模型,按字母排序
                    return sorted(model_ids)
                    
                except Exception as api_error:
                    print(f"OpenAI API调用失败: {api_error}")
                    raise Exception(f"无法获取模型列表: {str(api_error)}")
                
        except Exception as e:
            error_msg = str(e)
            print(f"获取模型列表失败: {error_msg}")
            # 不返回默认列表,而是抛出异常让前端处理
            raise Exception(f"获取模型列表失败: {error_msg}")
    
    @staticmethod
    def test_connection(base_url: str, api_key: str, model: str) -> dict:
        """
        测试API连接
        """
        try:
            # 判断是否是Gemini API
            is_gemini = 'generativelanguage.googleapis.com' in base_url or 'gemini' in base_url.lower()
            
            if is_gemini:
                # 测试Gemini连接
                try:
                    genai.configure(api_key=api_key)
                    
                    # 配置安全设置 - 使用正确的枚举格式
                    from google.generativeai.types import HarmCategory, HarmBlockThreshold
                    
                    try:
                        test_model = genai.GenerativeModel(
                            model,
                            safety_settings={
                                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
                            }
                        )
                    except Exception as model_error:
                        # 如果安全设置失败,尝试不带安全设置创建模型
                        print(f"使用安全设置创建模型失败,尝试默认设置: {model_error}")
                        test_model = genai.GenerativeModel(model)
                    
                    # 使用简单的数学问题作为测试
                    try:
                        response = test_model.generate_content(
                            "1+1=?",
                            generation_config=genai.GenerationConfig(
                                max_output_tokens=10,
                                temperature=0
                            )
                        )
                    except Exception as gen_error:
                        # 如果生成失败,返回更详细的错误信息
                        error_msg = str(gen_error)
                        if "API key" in error_msg:
                            return {
                                "success": False,
                                "message": f"API Key错误: {error_msg}"
                            }
                        elif "quota" in error_msg.lower():
                            return {
                                "success": False,
                                "message": f"配额不足: {error_msg}"
                            }
                        elif "not found" in error_msg.lower() or "404" in error_msg:
                            return {
                                "success": False,
                                "message": f"模型不存在或无权访问: {model}\n错误: {error_msg}"
                            }
                        else:
                            return {
                                "success": False,
                                "message": f"生成内容失败: {error_msg}"
                            }
                    
                    # 检查响应是否被阻止
                    if not response.candidates:
                        return {
                            "success": False,
                            "message": "连接成功但响应为空,可能被安全过滤器阻止"
                        }
                    
                    # 检查安全评级
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'finish_reason') and candidate.finish_reason != 1:  # 1 = STOP
                        safety_ratings = getattr(candidate, 'safety_ratings', [])
                        return {
                            "success": False,
                            "message": f"响应被阻止,原因: {candidate.finish_reason}, 安全评级: {safety_ratings}"
                        }
                    
                    # 尝试获取文本
                    try:
                        response_text = response.text[:50]
                    except:
                        response_text = "响应成功但无法获取文本内容"
                    
                    return {
                        "success": True,
                        "message": "连接成功",
                        "response": response_text
                    }
                except Exception as gemini_error:
                    error_msg = str(gemini_error)
                    # 提供更友好的错误信息
                    if "API key" in error_msg:
                        return {
                            "success": False,
                            "message": f"API Key错误,请检查密钥是否正确"
                        }
                    elif "permission" in error_msg.lower():
                        return {
                            "success": False,
                            "message": f"权限错误,请检查API Key权限或模型访问权限"
                        }
                    else:
                        return {
                            "success": False,
                            "message": f"Gemini连接失败: {error_msg}"
                        }
            else:
                # 测试OpenAI连接
                try:
                    # 创建自定义httpx客户端
                    http_client = httpx.Client(timeout=30.0)
                    client = openai.OpenAI(
                        api_key=api_key,
                        base_url=base_url,
                        http_client=http_client
                    )
                    response = client.chat.completions.create(
                        model=model,
                        messages=[{"role": "user", "content": "Hello"}],
                        max_tokens=20,
                        temperature=0
                    )
                    return {
                        "success": True,
                        "message": "连接成功",
                        "response": response.choices[0].message.content
                    }
                except Exception as openai_error:
                    return {
                        "success": False,
                        "message": f"OpenAI连接失败: {str(openai_error)}"
                    }
                
        except Exception as e:
            return {
                "success": False,
                "message": f"连接失败: {str(e)}"
            }
