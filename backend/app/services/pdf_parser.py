"""
PDF 解析服务 - 混合模式
优先使用 PyMuPDF 提取文本,失败时转换为图片调用 LLM
"""
import fitz  # PyMuPDF
from pdf2image import convert_from_path
from PIL import Image
import io
import base64
from typing import Optional, Tuple


class PDFParser:
    def __init__(self):
        self.min_text_length = 100  # 最小文本长度阈值
        self.min_char_ratio = 0.5   # 最小字符比例阈值
    
    def parse(self, pdf_path: str) -> Tuple[str, str]:
        """
        解析 PDF 文件
        
        Returns:
            Tuple[str, str]: (提取的文本, 使用的模式: 'text' 或 'image')
        """
        # 尝试文本提取
        text, quality = self._extract_text(pdf_path)
        
        if quality == 'good':
            return text, 'text'
        
        # 文本质量差,转换为图片
        print(f"文本质量不佳,切换到图片模式")
        return self._convert_to_images(pdf_path), 'image'
    
    def _extract_text(self, pdf_path: str) -> Tuple[str, str]:
        """
        使用 PyMuPDF 提取文本
        
        Returns:
            Tuple[str, str]: (文本内容, 质量评估: 'good' 或 'poor')
        """
        try:
            doc = fitz.open(pdf_path)
            text_parts = []
            
            for page in doc:
                text = page.get_text()
                text_parts.append(text)
            
            doc.close()
            
            full_text = '\n'.join(text_parts)
            quality = self._assess_text_quality(full_text)
            
            return full_text, quality
            
        except Exception as e:
            print(f"文本提取失败: {e}")
            return "", "poor"
    
    def _assess_text_quality(self, text: str) -> str:
        """
        评估提取文本的质量
        """
        if len(text) < self.min_text_length:
            return "poor"
        
        # 检查可打印字符比例
        printable_chars = sum(1 for c in text if c.isprintable())
        ratio = printable_chars / len(text) if len(text) > 0 else 0
        
        if ratio < self.min_char_ratio:
            return "poor"
        
        return "good"
    
    def _convert_to_images(self, pdf_path: str) -> str:
        """
        将 PDF 转换为图片的 base64 编码
        只转换第一页(简历通常在第一页)
        
        Returns:
            str: base64 编码的图片数据,格式: data:image/jpeg;base64,xxx
        """
        try:
            # 转换第一页为图片
            images = convert_from_path(pdf_path, first_page=1, last_page=1, dpi=200)
            
            if not images:
                raise ValueError("PDF 转换图片失败")
            
            # 将图片转换为 base64
            img = images[0]
            buffered = io.BytesIO()
            img.save(buffered, format="JPEG", quality=85)
            img_base64 = base64.b64encode(buffered.getvalue()).decode()
            
            return f"data:image/jpeg;base64,{img_base64}"
            
        except Exception as e:
            print(f"PDF 转图片失败: {e}")
            raise
