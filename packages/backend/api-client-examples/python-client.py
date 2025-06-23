"""
DataCloak Sentiment Workbench Python Client

A comprehensive Python client for the DataCloak API with support for
synchronous and asynchronous operations, type hints, and error handling.
"""

import asyncio
import json
import time
from typing import Dict, List, Optional, Union, Any, AsyncGenerator
from urllib.parse import urlencode
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class DataCloakError(Exception):
    """Custom exception for DataCloak API errors"""
    
    def __init__(self, message: str, status_code: int = None, error_code: str = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
    
    def __str__(self):
        if self.error_code:
            return f"{self.message} (Code: {self.error_code})"
        return self.message


class DataCloakClient:
    """
    Synchronous client for DataCloak Sentiment Workbench API
    """
    
    def __init__(
        self,
        base_url: str = "http://localhost:3001",
        token: Optional[str] = None,
        timeout: int = 30,
        max_retries: int = 3
    ):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.timeout = timeout
        
        # Configure session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set default headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'DataCloak-Python-Client/1.0.0'
        })
        
        if self.token:
            self.session.headers['Authorization'] = f'Bearer {self.token}'
    
    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        files: Optional[Dict] = None,
        headers: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to API"""
        url = f"{self.base_url}{endpoint}"
        
        # Prepare request arguments
        kwargs = {
            'timeout': self.timeout,
            'params': params
        }
        
        if headers:
            kwargs['headers'] = headers
        
        if files:
            # For file uploads, don't set JSON content type
            if 'Content-Type' in self.session.headers:
                temp_headers = self.session.headers.copy()
                del temp_headers['Content-Type']
                kwargs['headers'] = temp_headers
            kwargs['files'] = files
            if data:
                kwargs['data'] = data
        elif data:
            kwargs['json'] = data
        
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            try:
                error_data = response.json()
                raise DataCloakError(
                    error_data.get('error', str(e)),
                    response.status_code,
                    error_data.get('code')
                )
            except ValueError:
                raise DataCloakError(str(e), response.status_code)
        except requests.exceptions.RequestException as e:
            raise DataCloakError(f"Request failed: {str(e)}")
    
    # Authentication methods
    def login(self, username: str, password: str) -> Dict[str, Any]:
        """Authenticate user and get JWT token"""
        response = self._request('POST', '/api/auth/login', {
            'username': username,
            'password': password
        })
        
        if response.get('success') and response.get('data', {}).get('token'):
            self.token = response['data']['token']
            self.session.headers['Authorization'] = f'Bearer {self.token}'
        
        return response
    
    def verify_token(self) -> Dict[str, Any]:
        """Verify JWT token validity"""
        return self._request('POST', '/api/auth/verify')
    
    # Sentiment Analysis methods
    def analyze_sentiment(
        self,
        text: str,
        model: str = "gpt-3.5-turbo",
        include_emotions: bool = False,
        include_keywords: bool = False,
        language: str = "en"
    ) -> Dict[str, Any]:
        """Analyze sentiment of text"""
        return self._request('POST', '/api/v1/sentiment/analyze', {
            'text': text,
            'options': {
                'model': model,
                'includeEmotions': include_emotions,
                'includeKeywords': include_keywords,
                'language': language
            }
        })
    
    def batch_analyze_sentiment(
        self,
        texts: List[str],
        model: str = "gpt-3.5-turbo",
        parallel: bool = True,
        include_emotions: bool = False
    ) -> Dict[str, Any]:
        """Batch analyze sentiment for multiple texts"""
        return self._request('POST', '/api/v1/sentiment/batch', {
            'texts': texts,
            'options': {
                'model': model,
                'parallel': parallel,
                'includeEmotions': include_emotions
            }
        })
    
    def get_sentiment_history(
        self,
        limit: int = 50,
        offset: int = 0,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        sentiment: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get sentiment analysis history"""
        params = {'limit': limit, 'offset': offset}
        if start_date:
            params['startDate'] = start_date
        if end_date:
            params['endDate'] = end_date
        if sentiment:
            params['sentiment'] = sentiment
        
        return self._request('GET', '/api/v1/sentiment/history', params=params)
    
    def get_sentiment_statistics(self) -> Dict[str, Any]:
        """Get sentiment analysis statistics"""
        return self._request('GET', '/api/v1/sentiment/statistics')
    
    def estimate_cost(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Estimate analysis cost"""
        return self._request('POST', '/api/v1/sentiment/estimate-cost', data)
    
    # Security & PII Detection methods
    def detect_pii(
        self,
        text: str,
        types: Optional[List[str]] = None,
        confidence: float = 0.8,
        include_position: bool = True
    ) -> Dict[str, Any]:
        """Detect PII in text"""
        options = {
            'confidence': confidence,
            'includePosition': include_position
        }
        if types:
            options['types'] = types
        
        return self._request('POST', '/api/v1/security/detect', {
            'text': text,
            'options': options
        })
    
    def mask_sensitive_data(
        self,
        text: str,
        mask_char: str = "*",
        preserve_length: bool = True,
        mask_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Mask sensitive information in text"""
        options = {
            'maskChar': mask_char,
            'preserveLength': preserve_length
        }
        if mask_types:
            options['maskTypes'] = mask_types
        
        return self._request('POST', '/api/v1/security/mask', {
            'text': text,
            'options': options
        })
    
    def audit_security(self, file_path: str) -> Dict[str, Any]:
        """Audit security of a file"""
        return self._request('POST', '/api/v1/security/audit/file', {
            'filePath': file_path
        })
    
    def scan_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """Scan dataset for security issues"""
        return self._request('POST', '/api/v1/security/scan/dataset', {
            'datasetId': dataset_id
        })
    
    def get_security_metrics(self) -> Dict[str, Any]:
        """Get security metrics"""
        return self._request('GET', '/api/v1/security/metrics')
    
    # Data Management methods
    def upload_dataset(
        self,
        file_path: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Upload dataset file"""
        metadata = {}
        if name:
            metadata['name'] = name
        if description:
            metadata['description'] = description
        if tags:
            metadata['tags'] = tags
        
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'metadata': json.dumps(metadata)} if metadata else None
            return self._request('POST', '/api/v1/data/upload', data=data, files=files)
    
    def get_datasets(
        self,
        limit: int = 20,
        offset: int = 0,
        search: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Get list of datasets"""
        params = {'limit': limit, 'offset': offset}
        if search:
            params['search'] = search
        if tags:
            params['tags'] = ','.join(tags)
        
        return self._request('GET', '/api/v1/data/datasets', params=params)
    
    def get_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """Get dataset by ID"""
        return self._request('GET', f'/api/v1/data/datasets/{dataset_id}')
    
    def delete_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """Delete dataset"""
        return self._request('DELETE', f'/api/v1/data/datasets/{dataset_id}')
    
    def export_data(self, dataset_id: str, **options) -> Dict[str, Any]:
        """Export dataset"""
        data = {'datasetId': dataset_id, **options}
        return self._request('POST', '/api/v1/data/export', data)
    
    # Job Management methods
    def create_job(
        self,
        job_type: str,
        data: Dict[str, Any],
        priority: str = "medium",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a new processing job"""
        return self._request('POST', '/api/v1/jobs', {
            'type': job_type,
            'data': data,
            'priority': priority,
            'metadata': metadata or {}
        })
    
    def get_job(self, job_id: str) -> Dict[str, Any]:
        """Get job status and details"""
        return self._request('GET', f'/api/v1/jobs/{job_id}')
    
    def get_jobs(
        self,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get list of jobs"""
        params = {'limit': limit, 'offset': offset}
        if status:
            params['status'] = status
        if job_type:
            params['type'] = job_type
        
        return self._request('GET', '/api/v1/jobs', params=params)
    
    def cancel_job(self, job_id: str) -> Dict[str, Any]:
        """Cancel a job"""
        return self._request('DELETE', f'/api/v1/jobs/{job_id}')
    
    def get_job_progress(self, job_id: str) -> Dict[str, Any]:
        """Get detailed job progress"""
        return self._request('GET', f'/api/v1/jobs/{job_id}/progress')
    
    def wait_for_job(self, job_id: str, timeout: int = 60000) -> Dict[str, Any]:
        """Wait for job completion"""
        return self._request('POST', f'/api/v1/jobs/{job_id}/wait', {
            'timeout': timeout
        })
    
    def poll_job_completion(
        self,
        job_id: str,
        interval: int = 2,
        max_wait: int = 3600
    ) -> Dict[str, Any]:
        """Poll job until completion or timeout"""
        start_time = time.time()
        
        while True:
            if time.time() - start_time > max_wait:
                raise DataCloakError(f"Job {job_id} did not complete within {max_wait} seconds")
            
            job_status = self.get_job(job_id)
            status = job_status.get('data', {}).get('status')
            
            if status == 'completed':
                return job_status
            elif status == 'failed':
                error = job_status.get('data', {}).get('error', 'Job failed')
                raise DataCloakError(f"Job {job_id} failed: {error}")
            elif status == 'cancelled':
                raise DataCloakError(f"Job {job_id} was cancelled")
            
            time.sleep(interval)
    
    # Health & Monitoring methods
    def get_health(self) -> Dict[str, Any]:
        """Get basic health status"""
        return self._request('GET', '/health')
    
    def get_detailed_health(self) -> Dict[str, Any]:
        """Get detailed health status"""
        return self._request('GET', '/api/v1/health/status')
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Get system metrics"""
        return self._request('GET', '/api/v1/monitoring/system')
    
    def get_memory_metrics(self) -> Dict[str, Any]:
        """Get memory metrics"""
        return self._request('GET', '/api/v1/monitoring/memory/current')
    
    # Configuration methods (admin only)
    def get_config(self) -> Dict[str, Any]:
        """Get configuration (admin only)"""
        return self._request('GET', '/api/config')
    
    def update_config(self, key: str, value: Any) -> Dict[str, Any]:
        """Update single configuration value (admin only)"""
        return self._request('PUT', '/api/config', {'key': key, 'value': value})
    
    def batch_update_config(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update multiple configuration values (admin only)"""
        return self._request('PUT', '/api/config/batch', {'updates': updates})
    
    # Utility methods
    def test_connection(self) -> bool:
        """Test connection to API"""
        try:
            self.get_health()
            return True
        except DataCloakError:
            return False


# Async client for high-performance operations
class AsyncDataCloakClient:
    """
    Asynchronous client for DataCloak Sentiment Workbench API
    Requires aiohttp: pip install aiohttp
    """
    
    def __init__(
        self,
        base_url: str = "http://localhost:3001",
        token: Optional[str] = None,
        timeout: int = 30,
        max_retries: int = 3
    ):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.timeout = timeout
        self.max_retries = max_retries
        self._session = None
    
    async def __aenter__(self):
        await self._ensure_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._session:
            await self._session.close()
    
    async def _ensure_session(self):
        """Ensure aiohttp session exists"""
        if self._session is None:
            try:
                import aiohttp
                
                headers = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'DataCloak-Python-AsyncClient/1.0.0'
                }
                
                if self.token:
                    headers['Authorization'] = f'Bearer {self.token}'
                
                timeout = aiohttp.ClientTimeout(total=self.timeout)
                self._session = aiohttp.ClientSession(
                    headers=headers,
                    timeout=timeout
                )
            except ImportError:
                raise DataCloakError("aiohttp is required for async client. Install with: pip install aiohttp")
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make async HTTP request to API"""
        await self._ensure_session()
        url = f"{self.base_url}{endpoint}"
        
        kwargs = {'params': params}
        if data:
            kwargs['json'] = data
        
        for attempt in range(self.max_retries + 1):
            try:
                async with self._session.request(method, url, **kwargs) as response:
                    if response.status >= 400:
                        try:
                            error_data = await response.json()
                            raise DataCloakError(
                                error_data.get('error', f'HTTP {response.status}'),
                                response.status,
                                error_data.get('code')
                            )
                        except (ValueError, TypeError):
                            raise DataCloakError(f'HTTP {response.status}', response.status)
                    
                    return await response.json()
            
            except DataCloakError:
                raise
            except Exception as e:
                if attempt == self.max_retries:
                    raise DataCloakError(f"Request failed after {self.max_retries + 1} attempts: {str(e)}")
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
    
    # Async versions of main methods
    async def analyze_sentiment(
        self,
        text: str,
        model: str = "gpt-3.5-turbo",
        include_emotions: bool = False,
        include_keywords: bool = False,
        language: str = "en"
    ) -> Dict[str, Any]:
        """Async analyze sentiment of text"""
        return await self._request('POST', '/api/v1/sentiment/analyze', {
            'text': text,
            'options': {
                'model': model,
                'includeEmotions': include_emotions,
                'includeKeywords': include_keywords,
                'language': language
            }
        })
    
    async def batch_analyze_sentiment(
        self,
        texts: List[str],
        model: str = "gpt-3.5-turbo",
        parallel: bool = True,
        include_emotions: bool = False
    ) -> Dict[str, Any]:
        """Async batch analyze sentiment"""
        return await self._request('POST', '/api/v1/sentiment/batch', {
            'texts': texts,
            'options': {
                'model': model,
                'parallel': parallel,
                'includeEmotions': include_emotions
            }
        })
    
    async def detect_pii(
        self,
        text: str,
        types: Optional[List[str]] = None,
        confidence: float = 0.8,
        include_position: bool = True
    ) -> Dict[str, Any]:
        """Async detect PII in text"""
        options = {
            'confidence': confidence,
            'includePosition': include_position
        }
        if types:
            options['types'] = types
        
        return await self._request('POST', '/api/v1/security/detect', {
            'text': text,
            'options': options
        })
    
    async def get_job(self, job_id: str) -> Dict[str, Any]:
        """Async get job status"""
        return await self._request('GET', f'/api/v1/jobs/{job_id}')
    
    async def poll_job_completion(
        self,
        job_id: str,
        interval: int = 2,
        max_wait: int = 3600
    ) -> Dict[str, Any]:
        """Async poll job until completion"""
        start_time = time.time()
        
        while True:
            if time.time() - start_time > max_wait:
                raise DataCloakError(f"Job {job_id} did not complete within {max_wait} seconds")
            
            job_status = await self.get_job(job_id)
            status = job_status.get('data', {}).get('status')
            
            if status == 'completed':
                return job_status
            elif status == 'failed':
                error = job_status.get('data', {}).get('error', 'Job failed')
                raise DataCloakError(f"Job {job_id} failed: {error}")
            elif status == 'cancelled':
                raise DataCloakError(f"Job {job_id} was cancelled")
            
            await asyncio.sleep(interval)


# Usage Examples
if __name__ == "__main__":
    # Synchronous client example
    client = DataCloakClient(
        base_url='http://localhost:3001',
        token='your-jwt-token'
    )
    
    try:
        # Test connection
        if client.test_connection():
            print("✅ Connected to DataCloak API")
        
        # Sentiment analysis
        result = client.analyze_sentiment(
            "I love this new product! It's amazing.",
            model='gpt-4',
            include_emotions=True,
            include_keywords=True
        )
        print("Sentiment Analysis Result:", result)
        
        # Batch analysis
        texts = [
            "This product is great!",
            "I'm not satisfied with the service.",
            "The experience was okay."
        ]
        batch_result = client.batch_analyze_sentiment(texts, model='gpt-4')
        print("Batch Analysis Result:", batch_result)
        
        # PII detection
        pii_result = client.detect_pii(
            "My email is john.doe@example.com and phone is 555-123-4567",
            types=['EMAIL', 'PHONE'],
            confidence=0.8
        )
        print("PII Detection Result:", pii_result)
        
        # Job creation and monitoring
        job = client.create_job('sentiment_analysis', {
            'datasetId': 'dataset_123',
            'options': {'model': 'gpt-4'}
        })
        print("Job Created:", job)
        
        # Wait for job completion
        completed_job = client.poll_job_completion(job['data']['jobId'])
        print("Job Completed:", completed_job)
        
    except DataCloakError as e:
        print(f"❌ DataCloak API Error: {e}")
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
    
    
    # Async client example
    async def async_example():
        async with AsyncDataCloakClient(
            base_url='http://localhost:3001',
            token='your-jwt-token'
        ) as async_client:
            
            # Parallel sentiment analysis
            tasks = [
                async_client.analyze_sentiment(text)
                for text in [
                    "I love this!",
                    "This is terrible.",
                    "It's okay."
                ]
            ]
            
            results = await asyncio.gather(*tasks)
            print("Async Parallel Results:", results)
    
    # Run async example
    # asyncio.run(async_example())