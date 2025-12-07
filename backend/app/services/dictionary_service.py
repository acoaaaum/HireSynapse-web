"""
字典服务 - 公司和院校名称归一化 (优化版)

优化内容:
1. 线程安全(添加锁)
2. 优化数据结构(标准名作为key)
3. 备份机制
4. 缓存优化
5. 增量更新
6. 统计分析
7. 搜索过滤
8. 质量检查
9. 完整类型注解
10. 完善错误处理
"""
import json
import gzip
import pickle
import shutil
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from threading import Lock
from datetime import datetime
from functools import lru_cache
from collections import defaultdict
from rapidfuzz import fuzz, process

logger = logging.getLogger(__name__)


class DictionaryService:
    """字典服务 - 线程安全的公司和院校名称归一化"""
    
    CACHE_VERSION = "v2"
    MAX_BACKUPS = 10
    
    def __init__(self, dict_dir: str = "dictionaries"):
        """
        初始化字典服务
        
        Args:
            dict_dir: 字典文件目录
        """
        self.dict_dir = Path(dict_dir)
        self._lock = Lock()  # 线程锁
        
        # 加载字典数据
        self.companies: Dict[str, Dict[str, Any]] = self._load_dictionary_with_cache(
            "companies.json", "companies"
        )
        self.universities: Dict[str, Dict[str, Any]] = self._load_dictionary_with_cache(
            "universities.json", "universities"
        )
        
        # 构建快速查找索引
        self.company_index: Dict[str, str] = self._build_index(self.companies)
        self.university_index: Dict[str, str] = self._build_index(self.universities)
        
        logger.info(
            f"字典服务初始化完成: {len(self.companies)} 个公司, "
            f"{len(self.universities)} 个大学"
        )
    
    def _load_dictionary(self, filename: str, key: str) -> Dict[str, Dict[str, Any]]:
        """
        加载字典文件
        
        Args:
            filename: 文件名
            key: JSON中的键名
            
        Returns:
            字典数据
            
        Raises:
            FileNotFoundError: 文件不存在
            json.JSONDecodeError: JSON格式错误
        """
        file_path = self.dict_dir / filename
        
        if not file_path.exists():
            logger.warning(f"字典文件不存在: {file_path}, 将创建空字典")
            return {}
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                result = data.get(key, {})
                
                if not isinstance(result, dict):
                    raise ValueError(f"字典格式错误: {key} 应该是对象")
                
                logger.info(f"成功加载字典 {filename}: {len(result)} 个标准名")
                return result
                
        except json.JSONDecodeError as e:
            logger.error(f"JSON 解析失败 {filename}: {e}")
            raise
        except Exception as e:
            logger.error(f"加载字典失败 {filename}: {e}", exc_info=True)
            raise
    
    def _load_dictionary_with_cache(
        self, filename: str, key: str
    ) -> Dict[str, Dict[str, Any]]:
        """
        加载字典(带缓存)
        
        Args:
            filename: 文件名
            key: JSON中的键名
            
        Returns:
            字典数据
        """
        json_path = self.dict_dir / filename
        cache_path = self.dict_dir / f".cache_{filename}.pkl.gz"
        
        # 检查缓存是否有效
        if cache_path.exists() and json_path.exists():
            try:
                json_mtime = json_path.stat().st_mtime
                cache_mtime = cache_path.stat().st_mtime
                
                if cache_mtime > json_mtime:
                    # 使用缓存
                    with gzip.open(cache_path, 'rb') as f:
                        cached = pickle.load(f)
                        if cached.get('version') == self.CACHE_VERSION:
                            logger.info(f"从缓存加载字典 {filename}")
                            return cached['data']
            except Exception as e:
                logger.warning(f"缓存加载失败: {e}")
        
        # 从 JSON 加载
        data = self._load_dictionary(filename, key)
        
        # 保存缓存
        try:
            with gzip.open(cache_path, 'wb') as f:
                pickle.dump({
                    'version': self.CACHE_VERSION,
                    'data': data
                }, f)
            logger.info(f"已缓存字典 {filename}")
        except Exception as e:
            logger.warning(f"缓存保存失败: {e}")
        
        return data
    
    def _build_index(self, dictionary: Dict[str, Dict[str, Any]]) -> Dict[str, str]:
        """
        构建别名到标准名的索引
        
        Args:
            dictionary: 字典数据
            
        Returns:
            别名(小写) -> 标准名的映射
        """
        index = {}
        for standard, info in dictionary.items():
            # 标准名本身也作为 key
            index[standard.lower()] = standard
            # 所有别名指向标准名
            for alias in info.get('aliases', []):
                index[alias.lower()] = standard
        return index
    
    @lru_cache(maxsize=1000)
    def _fuzzy_match_cached(
        self, query: str, dict_type: str, threshold: int
    ) -> Tuple[Optional[str], int]:
        """
        缓存的模糊匹配
        
        Args:
            query: 查询字符串(小写)
            dict_type: 字典类型 ('company' 或 'university')
            threshold: 相似度阈值
            
        Returns:
            (标准名, 相似度分数) 或 (None, 0)
        """
        if dict_type == 'company':
            aliases = list(self.company_index.keys())
            index = self.company_index
        else:
            aliases = list(self.university_index.keys())
            index = self.university_index
        
        result = process.extractOne(
            query,
            aliases,
            scorer=fuzz.ratio,
            score_cutoff=threshold
        )
        
        if result:
            matched_alias, score, _ = result
            return index[matched_alias], score
        return None, 0
    
    def normalize_company(self, company_name: str, threshold: int = 80) -> str:
        """
        归一化公司名称
        
        Args:
            company_name: 原始公司名称
            threshold: 模糊匹配阈值 (0-100)
            
        Returns:
            标准化后的公司名称,如果未找到匹配则返回原名称
        """
        if not company_name:
            return ""
        
        # 精确匹配
        company_lower = company_name.lower()
        if company_lower in self.company_index:
            return self.company_index[company_lower]
        
        # 模糊匹配(使用缓存)
        standard, score = self._fuzzy_match_cached(company_lower, 'company', threshold)
        
        if standard:
            logger.info(f"公司名称匹配: {company_name} -> {standard} (相似度: {score})")
            return standard
        
        return company_name
    
    def normalize_university(self, university_name: str, threshold: int = 80) -> str:
        """
        归一化院校名称
        
        Args:
            university_name: 原始院校名称
            threshold: 模糊匹配阈值 (0-100)
            
        Returns:
            标准化后的院校名称,如果未找到匹配则返回原名称
        """
        if not university_name:
            return ""
        
        # 精确匹配
        university_lower = university_name.lower()
        if university_lower in self.university_index:
            return self.university_index[university_lower]
        
        # 模糊匹配(使用缓存)
        standard, score = self._fuzzy_match_cached(
            university_lower, 'university', threshold
        )
        
        if standard:
            logger.info(f"院校名称匹配: {university_name} -> {standard} (相似度: {score})")
            return standard
        
        return university_name
    
    def _save_dictionary(
        self, filename: str, key: str, data: Dict[str, Dict[str, Any]]
    ) -> None:
        """
        保存字典到文件(带备份)
        
        Args:
            filename: 文件名
            key: JSON中的键名
            data: 字典数据
            
        Raises:
            IOError: 文件写入失败
        """
        file_path = self.dict_dir / filename
        backup_dir = self.dict_dir / "backups"
        backup_dir.mkdir(exist_ok=True)
        
        backup_path = None
        
        try:
            # 1. 创建备份
            if file_path.exists():
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_path = backup_dir / f"{filename}.{timestamp}.bak"
                shutil.copy2(file_path, backup_path)
                logger.info(f"已创建备份: {backup_path}")
                
                # 2. 清理旧备份(保留最近10个)
                backups = sorted(backup_dir.glob(f"{filename}.*.bak"))
                if len(backups) > self.MAX_BACKUPS:
                    for old_backup in backups[:-self.MAX_BACKUPS]:
                        old_backup.unlink()
                        logger.info(f"已删除旧备份: {old_backup}")
            
            # 3. 写入新数据(原子操作)
            temp_path = file_path.with_suffix('.tmp')
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump({key: data}, f, ensure_ascii=False, indent=2)
            
            # 4. 原子替换
            temp_path.replace(file_path)
            logger.info(f"已保存字典: {filename}")
            
            # 5. 清除缓存
            cache_path = self.dict_dir / f".cache_{filename}.pkl.gz"
            if cache_path.exists():
                cache_path.unlink()
            
        except Exception as e:
            logger.error(f"保存字典失败 {filename}: {e}", exc_info=True)
            # 恢复备份
            if backup_path and backup_path.exists():
                shutil.copy2(backup_path, file_path)
                logger.info(f"已从备份恢复: {backup_path}")
            raise
    
    def add_company_mapping(self, alias: str, standard: str) -> None:
        """
        添加公司映射(线程安全)
        
        Args:
            alias: 别名
            standard: 标准名称
        """
        with self._lock:
            if standard not in self.companies:
                self.companies[standard] = {
                    "standard": standard,
                    "aliases": [standard]
                }
            
            # 添加别名(去重)
            aliases = self.companies[standard].get('aliases', [])
            if alias not in aliases:
                aliases.append(alias)
                self.companies[standard]['aliases'] = aliases
            
            # 更新索引
            self.company_index[alias.lower()] = standard
            
            # 保存
            self._save_dictionary("companies.json", "companies", self.companies)
            
            # 清除缓存
            self._fuzzy_match_cached.cache_clear()
    
    def add_university_mapping(self, alias: str, standard: str) -> None:
        """
        添加院校映射(线程安全)
        
        Args:
            alias: 别名
            standard: 标准名称
        """
        with self._lock:
            if standard not in self.universities:
                self.universities[standard] = {
                    "standard": standard,
                    "aliases": [standard]
                }
            
            # 添加别名(去重)
            aliases = self.universities[standard].get('aliases', [])
            if alias not in aliases:
                aliases.append(alias)
                self.universities[standard]['aliases'] = aliases
            
            # 更新索引
            self.university_index[alias.lower()] = standard
            
            # 保存
            self._save_dictionary("universities.json", "universities", self.universities)
            
            # 清除缓存
            self._fuzzy_match_cached.cache_clear()
    
    def get_companies(self) -> Dict[str, Dict[str, Any]]:
        """获取公司字典"""
        return self.companies
    
    def get_universities(self) -> Dict[str, Dict[str, Any]]:
        """获取院校字典"""
        return self.universities
    
    def update_companies(self, companies: Dict[str, Dict[str, Any]]) -> None:
        """
        更新公司字典(线程安全)
        
        Args:
            companies: 新的公司字典
        """
        with self._lock:
            self.companies = companies
            self.company_index = self._build_index(companies)
            self._save_dictionary("companies.json", "companies", companies)
            self._fuzzy_match_cached.cache_clear()
    
    def update_universities(self, universities: Dict[str, Dict[str, Any]]) -> None:
        """
        更新院校字典(线程安全)
        
        Args:
            universities: 新的院校字典
        """
        with self._lock:
            self.universities = universities
            self.university_index = self._build_index(universities)
            self._save_dictionary("universities.json", "universities", universities)
            self._fuzzy_match_cached.cache_clear()
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取字典统计信息
        
        Returns:
            统计信息字典
        """
        company_aliases = sum(
            len(info.get('aliases', [])) for info in self.companies.values()
        )
        university_aliases = sum(
            len(info.get('aliases', [])) for info in self.universities.values()
        )
        
        return {
            "companies": {
                "total_standards": len(self.companies),
                "total_aliases": company_aliases,
                "avg_aliases_per_company": (
                    company_aliases / len(self.companies) if self.companies else 0
                )
            },
            "universities": {
                "total_standards": len(self.universities),
                "total_aliases": university_aliases,
                "avg_aliases_per_university": (
                    university_aliases / len(self.universities) if self.universities else 0
                )
            }
        }
    
    def search_companies(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        搜索公司
        
        Args:
            query: 搜索关键词
            limit: 返回结果数量限制
            
        Returns:
            匹配的公司列表
        """
        query_lower = query.lower()
        results = []
        
        for standard, info in self.companies.items():
            if query_lower in standard.lower():
                results.append({"standard": standard, **info})
                if len(results) >= limit:
                    break
            else:
                # 搜索别名
                for alias in info.get('aliases', []):
                    if query_lower in alias.lower():
                        results.append({"standard": standard, **info})
                        if len(results) >= limit:
                            break
                if len(results) >= limit:
                    break
        
        return results
    
    def search_universities(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        搜索院校
        
        Args:
            query: 搜索关键词
            limit: 返回结果数量限制
            
        Returns:
            匹配的院校列表
        """
        query_lower = query.lower()
        results = []
        
        for standard, info in self.universities.items():
            if query_lower in standard.lower():
                results.append({"standard": standard, **info})
                if len(results) >= limit:
                    break
            else:
                # 搜索别名
                for alias in info.get('aliases', []):
                    if query_lower in alias.lower():
                        results.append({"standard": standard, **info})
                        if len(results) >= limit:
                            break
                if len(results) >= limit:
                    break
        
        return results
    
    def validate_dictionary(self) -> Dict[str, List[str]]:
        """
        验证字典质量
        
        Returns:
            问题列表字典
        """
        issues = {
            "empty_standard": [],
            "empty_aliases": [],
            "duplicate_aliases": [],
            "suspicious_standard": []
        }
        
        # 检查公司字典
        seen_aliases = {}
        for standard, info in self.companies.items():
            if not standard.strip():
                issues["empty_standard"].append("公司: (空标准名)")
            
            aliases = info.get('aliases', [])
            if not aliases:
                issues["empty_aliases"].append(f"公司: {standard}")
            
            # 检查重复别名
            for alias in aliases:
                alias_lower = alias.lower()
                if alias_lower in seen_aliases:
                    issues["duplicate_aliases"].append(
                        f"公司别名 '{alias}' 重复: {seen_aliases[alias_lower]} 和 {standard}"
                    )
                seen_aliases[alias_lower] = standard
            
            # 检查可疑的标准名
            if any(c in standard for c in ['/', '\\', '|', '<', '>']):
                issues["suspicious_standard"].append(f"公司: {standard}")
        
        # 检查院校字典
        seen_aliases = {}
        for standard, info in self.universities.items():
            if not standard.strip():
                issues["empty_standard"].append("院校: (空标准名)")
            
            aliases = info.get('aliases', [])
            if not aliases:
                issues["empty_aliases"].append(f"院校: {standard}")
            
            # 检查重复别名
            for alias in aliases:
                alias_lower = alias.lower()
                if alias_lower in seen_aliases:
                    issues["duplicate_aliases"].append(
                        f"院校别名 '{alias}' 重复: {seen_aliases[alias_lower]} 和 {standard}"
                    )
                seen_aliases[alias_lower] = standard
            
            # 检查可疑的标准名
            if any(c in standard for c in ['/', '\\', '|', '<', '>']):
                issues["suspicious_standard"].append(f"院校: {standard}")
        
        return {k: v for k, v in issues.items() if v}
    
    def rollback_to_backup(self, filename: str, backup_timestamp: str) -> None:
        """
        回滚到指定备份(线程安全)
        
        Args:
            filename: 文件名
            backup_timestamp: 备份时间戳
            
        Raises:
            FileNotFoundError: 备份不存在
        """
        with self._lock:
            backup_path = (
                self.dict_dir / "backups" / f"{filename}.{backup_timestamp}.bak"
            )
            if not backup_path.exists():
                raise FileNotFoundError(f"备份不存在: {backup_timestamp}")
            
            file_path = self.dict_dir / filename
            shutil.copy2(backup_path, file_path)
            logger.info(f"已从备份恢复: {backup_path}")
            
            # 重新加载
            if filename == "companies.json":
                self.companies = self._load_dictionary(filename, "companies")
                self.company_index = self._build_index(self.companies)
            elif filename == "universities.json":
                self.universities = self._load_dictionary(filename, "universities")
                self.university_index = self._build_index(self.universities)
            
            # 清除缓存
            self._fuzzy_match_cached.cache_clear()
    
    def list_backups(self, filename: str) -> List[Dict[str, str]]:
        """
        列出所有备份
        
        Args:
            filename: 文件名
            
        Returns:
            备份列表
        """
        backup_dir = self.dict_dir / "backups"
        if not backup_dir.exists():
            return []
        
        backups = []
        for backup_path in sorted(backup_dir.glob(f"{filename}.*.bak"), reverse=True):
            timestamp = backup_path.stem.split('.')[-1]
            size = backup_path.stat().st_size
            mtime = datetime.fromtimestamp(backup_path.stat().st_mtime)
            
            backups.append({
                "timestamp": timestamp,
                "size": size,
                "modified": mtime.isoformat(),
                "path": str(backup_path)
            })
        
        return backups
