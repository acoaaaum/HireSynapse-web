#!/usr/bin/env python3
"""
字典数据格式转换脚本
将旧格式(数组)转换为新格式(对象)
"""
import json
from pathlib import Path
from collections import defaultdict

def convert_dictionary(old_data_list):
    """
    转换字典格式
    
    旧格式: [{"alias": "THU", "standard": "清华大学"}, ...]
    新格式: {"清华大学": {"standard": "清华大学", "aliases": ["THU", "Tsinghua", ...]}}
    """
    new_data = {}
    
    # 按标准名分组
    grouped = defaultdict(list)
    for entry in old_data_list:
        alias = entry.get('alias', '').strip()
        standard = entry.get('standard', '').strip()
        if alias and standard:
            grouped[standard].append(alias)
    
    # 转换为新格式
    for standard, aliases in grouped.items():
        # 去重并排序
        unique_aliases = sorted(set(aliases))
        
        new_data[standard] = {
            "standard": standard,
            "aliases": unique_aliases
        }
    
    return new_data

def main():
    # 转换大学字典
    univ_path = Path('dictionaries/universities.json')
    with open(univ_path, 'r', encoding='utf-8') as f:
        old_data = json.load(f)
    
    old_universities = old_data.get('universities', [])
    new_universities = convert_dictionary(old_universities)
    
    # 保存新格式
    with open(univ_path, 'w', encoding='utf-8') as f:
        json.dump({'universities': new_universities}, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 转换完成:")
    print(f"   - 旧格式: {len(old_universities)} 条记录")
    print(f"   - 新格式: {len(new_universities)} 个标准名")
    print(f"   - 平均每个标准名有 {len(old_universities) / len(new_universities):.1f} 个别名")

if __name__ == '__main__':
    main()
