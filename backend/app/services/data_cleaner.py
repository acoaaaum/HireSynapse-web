"""
数据清洗服务 - 电话号码和现居地点标准化
"""
import re
from typing import Optional


class DataCleaner:
    # 地点映射字典
    LOCATION_MAPPINGS = {
        # 中国城市口语化名称
        "帝都": "北京",
        "魔都": "上海",
        "深圳湾": "深圳",
        "鹏城": "深圳",
        "羊城": "广州",
        "蓉城": "成都",
        "西安市": "西安",
        "杭州市": "杭州",
        
        # 美国地区
        "Bay Area": "加利福尼亚州",
        "SF": "加利福尼亚州",
        "San Francisco": "加利福尼亚州",
        "Silicon Valley": "加利福尼亚州",
        "Tri-Valley": "加利福尼亚州",
        "LA": "加利福尼亚州",
        "Los Angeles": "加利福尼亚州",
        "San Diego": "加利福尼亚州",
        "NYC": "纽约州",
        "New York": "纽约州",
        "Seattle": "华盛顿州",
        "Boston": "马萨诸塞州",
        "Chicago": "伊利诺伊州",
        "Austin": "得克萨斯州",
        "Dallas": "得克萨斯州",
        "Houston": "得克萨斯州",
        
        # 其他国家
        "London": "英国",
        "Tokyo": "日本",
        "Singapore": "新加坡",
        "Sydney": "澳大利亚",
        "Toronto": "加拿大",
        "Vancouver": "加拿大"
    }
    
    # 美国州名英文到中文
    US_STATES = {
        "California": "加利福尼亚州",
        "New York": "纽约州",
        "Washington": "华盛顿州",
        "Massachusetts": "马萨诸塞州",
        "Illinois": "伊利诺伊州",
        "Texas": "得克萨斯州",
        "Florida": "佛罗里达州",
        "Pennsylvania": "宾夕法尼亚州",
        "Ohio": "俄亥俄州",
        "Georgia": "佐治亚州"
    }
    
    def clean_phone(self, phone: str, default_country_code: str = "+86") -> str:
        """
        标准化电话号码为 E.164 格式
        
        Args:
            phone: 原始电话号码
            default_country_code: 默认国家码
            
        Returns:
            str: E.164 格式的电话号码,如 +8613900000000
        """
        if not phone:
            return ""
        
        # 去除所有非数字字符(保留+号)
        cleaned = re.sub(r'[^\d+]', '', phone)
        
        # 如果已经有国家码,直接返回
        if cleaned.startswith('+'):
            return cleaned
        
        # 智能补全国家码
        # 中国手机号(11位)
        if len(cleaned) == 11 and cleaned.startswith(('13', '14', '15', '16', '17', '18', '19')):
            return f"+86{cleaned}"
        
        # 美国手机号(10位)
        if len(cleaned) == 10:
            return f"+1{cleaned}"
        
        # 其他情况使用默认国家码
        return f"{default_country_code}{cleaned}"
    
    def clean_location(self, location: str) -> str:
        """
        标准化现居地点
        规则:
        - 中国 -> 城市名
        - 美国 -> 州名
        - 其他 -> 国家名
        - 去除街道/门牌号等详细信息
        - 统一输出中文
        
        Args:
            location: 原始地点信息
            
        Returns:
            str: 标准化后的地点
        """
        if not location:
            return ""
        
        # 去除逗号和多余空格
        location = location.replace(',', ' ').strip()
        location = re.sub(r'\s+', ' ', location)
        
        # 检查口语化地名映射
        for alias, standard in self.LOCATION_MAPPINGS.items():
            if alias.lower() in location.lower():
                return standard
        
        # 检查美国州名
        for state_en, state_zh in self.US_STATES.items():
            if state_en.lower() in location.lower():
                return state_zh
        
        # 中国城市检测
        chinese_cities = [
            "北京", "上海", "广州", "深圳", "杭州", "成都", "重庆", "武汉",
            "西安", "南京", "天津", "苏州", "郑州", "长沙", "东莞", "青岛",
            "沈阳", "宁波", "昆明", "合肥", "佛山", "福州", "无锡", "厦门",
            "哈尔滨", "济南", "温州", "南宁", "长春", "泉州", "石家庄", "贵阳",
            "南昌", "金华", "常州", "南通", "嘉兴", "太原", "徐州", "惠州",
            "珠海", "中山", "台州", "烟台", "兰州", "绍兴", "海口", "扬州"
        ]
        
        for city in chinese_cities:
            if city in location:
                return city
        
        # 检查是否包含"中国"
        if "中国" in location or "China" in location:
            # 尝试提取城市名(去除"中国"、省份等)
            parts = location.split()
            for part in parts:
                if part in chinese_cities:
                    return part
            # 如果无法提取城市,返回"中国"
            return "中国"
        
        # 检查是否包含"美国"或"USA"
        if "美国" in location or "USA" in location.upper() or "United States" in location:
            # 尝试提取州名
            for state_en, state_zh in self.US_STATES.items():
                if state_en.lower() in location.lower():
                    return state_zh
            return "美国"
        
        # 其他国家
        countries = {
            "Japan": "日本",
            "Singapore": "新加坡",
            "UK": "英国",
            "United Kingdom": "英国",
            "Canada": "加拿大",
            "Australia": "澳大利亚",
            "Germany": "德国",
            "France": "法国",
            "Korea": "韩国",
            "India": "印度"
        }
        
        for country_en, country_zh in countries.items():
            if country_en.lower() in location.lower():
                return country_zh
        
        # 如果无法识别,返回原始值(去除详细地址)
        # 尝试只保留第一个词
        first_word = location.split()[0] if location.split() else location
        return first_word
