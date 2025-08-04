import json
import re
import uuid
import logging
from typing import Dict, List, Optional, Any
import requests
import markdownify
from bs4 import BeautifulSoup

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Constants
SEARCH_API_URL = 'https://proxy.search.docs.aws.amazon.com/search'
RECOMMENDATIONS_API_URL = 'https://contentrecs-api.docs.aws.amazon.com/v1/recommendations'
DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 BedrockAgent/1.0'

def aws_docs_action_handler(event, context):
    """Main Lambda handler for Bedrock Agents."""
    logger.info(f"Event: {json.dumps(event, default=str)[:500]}...")
    
    try:
        action_group = event.get('actionGroup', '')
        api_path = event.get('apiPath', '')
        http_method = event.get('httpMethod', 'POST')
        request_body = event.get('requestBody', {})
        
        logger.info(f"API path: {api_path}, method: {http_method}")
        
        # Parse request body
        if 'content' in request_body:
            content = request_body['content']
            if 'application/json' in content:
                params = json.loads(content['application/json']['properties'])
            else:
                params = {}
        else:
            params = {}
        
        # Route based on API path
        if api_path == '/read_documentation':
            logger.info(f"Reading: {params.get('url')}")
            result = read_documentation(
                url=params.get('url'),
                max_length=int(params.get('max_length', 5000)),
                start_index=int(params.get('start_index', 0))
            )
        elif api_path == '/search_documentation':
            logger.info(f"Searching: {params.get('search_phrase')}")
            result = search_documentation(
                search_phrase=params.get('search_phrase'),
                limit=int(params.get('limit', 10))
            )
        elif api_path == '/recommend':
            logger.info(f"Recommending: {params.get('url')}")
            result = recommend(params.get('url'))
        else:
            logger.error(f"Unknown API path: {api_path}")
            result = {'error': f'Unknown API path: {api_path}'}
            return {
                'messageVersion': '1.0',
                'response': {
                    'actionGroup': action_group,
                    'apiPath': api_path,
                    'httpMethod': http_method,
                    'httpStatusCode': 400,
                    'responseBody': {
                        'application/json': {
                            'body': json.dumps(result, ensure_ascii=False)
                        }
                    }
                }
            }
        
        logger.info(f"Success: {api_path}, result type: {type(result)}")
        return {
            'messageVersion': '1.0',
            'response': {
                'actionGroup': action_group,
                'apiPath': api_path,
                'httpMethod': http_method,
                'httpStatusCode': 200,
                'responseBody': {
                    'application/json': {
                        'body': json.dumps(result, ensure_ascii=False)
                    }
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Handler error: {str(e)}", exc_info=True)
        return {
            'messageVersion': '1.0',
            'response': {
                'actionGroup': event.get('actionGroup', ''),
                'apiPath': event.get('apiPath', ''),
                'httpMethod': event.get('httpMethod', 'POST'),
                'httpStatusCode': 500,
                'responseBody': {
                    'application/json': {
                        'body': json.dumps({'error': str(e)}, ensure_ascii=False)
                    }
                }
            }
        }

def read_documentation(url: str, max_length: int = 5000, start_index: int = 0) -> str:
    """Fetch and convert AWS documentation page to markdown."""
    if not url:
        return "Error: URL is required"
    
    # Validate URL
    if not re.match(r'^https?://docs\.aws\.amazon\.com/', url):
        return "Error: URL must be from docs.aws.amazon.com domain"
    if not url.endswith('.html'):
        return "Error: URL must end with .html"
    
    session_uuid = str(uuid.uuid4())
    url_with_session = f'{url}?session={session_uuid}'
    
    try:
        logger.info(f"Fetching: {url_with_session}")
        response = requests.get(
            url_with_session,
            allow_redirects=True,
            headers={
                'Content-Type': 'application/json',
                'User-Agent': DEFAULT_USER_AGENT,
                'X-MCP-Session-Id': session_uuid,
            },
            timeout=30,
        )
        logger.info(f"Status: {response.status_code}")
    except Exception as e:
        logger.error(f"Fetch error: {str(e)}")
        return f"Error fetching {url}: {str(e)}"
    
    if response.status_code >= 400:
        logger.error(f"HTTP {response.status_code} for {url}")
        return f"Error fetching {url} - status code {response.status_code}"
    
    page_raw = response.text
    content_type = response.headers.get('content-type', '')
    
    # Process HTML content
    if is_html_content(page_raw, content_type):
        content = extract_content_from_html(page_raw)
    else:
        content = page_raw
    
    return format_documentation_result(url, content, start_index, max_length)

def search_documentation(search_phrase: str, limit: int = 10) -> List[Dict]:
    """Search AWS documentation."""
    if not search_phrase:
        return [{'error': 'Search phrase is required'}]
    
    session_uuid = str(uuid.uuid4())
    request_body = {
        'textQuery': {'input': search_phrase},
        'contextAttributes': [{'key': 'domain', 'value': 'docs.aws.amazon.com'}],
        'acceptSuggestionBody': 'RawText',
        'locales': ['en_us'],
    }
    
    search_url_with_session = f'{SEARCH_API_URL}?session={session_uuid}'
    
    try:
        logger.info(f"Searching: {search_phrase}")
        response = requests.post(
            search_url_with_session,
            json=request_body,
            headers={
                'Content-Type': 'application/json',
                'User-Agent': DEFAULT_USER_AGENT,
                'X-MCP-Session-Id': session_uuid,
            },
            timeout=30,
        )
        logger.info(f"Search status: {response.status_code}")
    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        return [{'error': f'Error searching AWS docs: {str(e)}'}]
    
    if response.status_code >= 400:
        logger.error(f"Search HTTP {response.status_code}")
        return [{'error': f'Error searching AWS docs - status code {response.status_code}'}]
    
    try:
        data = response.json()
    except Exception as e:
        return [{'error': f'Error parsing search results: {str(e)}'}]
    
    results = []
    if 'suggestions' in data:
        for i, suggestion in enumerate(data['suggestions'][:limit]):
            if 'textExcerptSuggestion' in suggestion:
                text_suggestion = suggestion['textExcerptSuggestion']
                context = text_suggestion.get('summary') or text_suggestion.get('suggestionBody')
                
                results.append({
                    'rank_order': i + 1,
                    'url': text_suggestion.get('link', ''),
                    'title': text_suggestion.get('title', ''),
                    'context': context or ''
                })
    
    logger.info(f"Found {len(results)} search results")
    return results if results else [{'message': 'No results found'}]

def recommend(url: str) -> List[Dict]:
    """Get content recommendations for AWS documentation page."""
    if not url:
        return [{'error': 'URL is required'}]
    
    session_uuid = str(uuid.uuid4())
    recommendation_url = f'{RECOMMENDATIONS_API_URL}?path={url}&session={session_uuid}'
    
    try:
        logger.info(f"Getting recommendations: {url}")
        response = requests.get(
            recommendation_url,
            headers={'User-Agent': DEFAULT_USER_AGENT},
            timeout=30,
        )
        logger.info(f"Recommendations status: {response.status_code}")
    except Exception as e:
        logger.error(f"Recommendations error: {str(e)}")
        return [{'error': f'Error getting recommendations: {str(e)}'}]
    
    if response.status_code >= 400:
        logger.error(f"Recommendations HTTP {response.status_code}")
        return [{'error': f'Error getting recommendations - status code {response.status_code}'}]
    
    try:
        data = response.json()
    except Exception as e:
        return [{'error': f'Error parsing recommendations: {str(e)}'}]
    
    results = parse_recommendation_results(data)
    logger.info(f"Found {len(results)} recommendations")
    return results

def extract_content_from_html(html: str) -> str:
    """Extract and convert HTML content to Markdown."""
    if not html:
        return '<e>Empty HTML content</e>'
    
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        # Find main content
        content_selectors = [
            'main', 'article', '#main-content', '.main-content', '#content',
            '.content', "div[role='main']", '#awsdocs-content', '.awsui-article'
        ]
        
        main_content = None
        for selector in content_selectors:
            content = soup.select_one(selector)
            if content:
                main_content = content
                break
        
        if not main_content:
            main_content = soup.body if soup.body else soup
        
        # Remove navigation elements
        nav_selectors = [
            'noscript', '.prev-next', '#main-col-footer', '.awsdocs-page-utilities',
            '#quick-feedback-yes', '#quick-feedback-no', '.page-loading-indicator',
            '#tools-panel', '.doc-cookie-banner', 'awsdocs-copyright', 'awsdocs-thumb-feedback'
        ]
        
        for selector in nav_selectors:
            for element in main_content.select(selector):
                element.decompose()
        
        # Tags to strip
        tags_to_strip = [
            'script', 'style', 'noscript', 'meta', 'link', 'footer', 'nav', 'aside', 'header',
            'awsdocs-cookie-consent-container', 'awsdocs-feedback-container', 'awsdocs-page-header',
            'awsdocs-page-header-container', 'awsdocs-filter-selector', 'awsdocs-breadcrumb-container',
            'awsdocs-page-footer', 'awsdocs-page-footer-container', 'awsdocs-footer', 'awsdocs-cookie-banner'
        ]
        
        content = markdownify.markdownify(
            str(main_content),
            heading_style=markdownify.ATX,
            autolinks=True,
            default_title=True,
            escape_asterisks=True,
            escape_underscores=True,
            newline_style='SPACES',
            strip=tags_to_strip,
        )
        
        return content if content else '<e>Page failed to be simplified from HTML</e>'
        
    except Exception as e:
        return f'<e>Error converting HTML to Markdown: {str(e)}</e>'

def is_html_content(page_raw: str, content_type: str) -> bool:
    """Determine if content is HTML."""
    return '<html' in page_raw[:100] or 'text/html' in content_type or not content_type

def format_documentation_result(url: str, content: str, start_index: int, max_length: int) -> str:
    """Format documentation result with pagination."""
    original_length = len(content)
    
    if start_index >= original_length:
        return f'AWS Documentation from {url}:\n\n<e>No more content available.</e>'
    
    end_index = min(start_index + max_length, original_length)
    truncated_content = content[start_index:end_index]
    
    if not truncated_content:
        return f'AWS Documentation from {url}:\n\n<e>No more content available.</e>'
    
    result = f'AWS Documentation from {url}:\n\n{truncated_content}'
    
    remaining_content = original_length - (start_index + len(truncated_content))
    if remaining_content > 0:
        next_start = start_index + len(truncated_content)
        result += f'\n\n<e>Content truncated. Call read_documentation with start_index={next_start} to get more content.</e>'
    
    return result

def parse_recommendation_results(data: Dict[str, Any]) -> List[Dict]:
    """Parse recommendation API response."""
    results = []
    
    # Highly rated recommendations
    if 'highlyRated' in data and 'items' in data['highlyRated']:
        for item in data['highlyRated']['items']:
            results.append({
                'url': item.get('url', ''),
                'title': item.get('assetTitle', ''),
                'context': item.get('abstract'),
                'type': 'highly_rated'
            })
    
    # Journey recommendations
    if 'journey' in data and 'items' in data['journey']:
        for intent_group in data['journey']['items']:
            intent = intent_group.get('intent', '')
            if 'urls' in intent_group:
                for url_item in intent_group['urls']:
                    results.append({
                        'url': url_item.get('url', ''),
                        'title': url_item.get('assetTitle', ''),
                        'context': f'Intent: {intent}' if intent else None,
                        'type': 'journey'
                    })
    
    # New content recommendations
    if 'new' in data and 'items' in data['new']:
        for item in data['new']['items']:
            date_created = item.get('dateCreated', '')
            context = f'New content added on {date_created}' if date_created else 'New content'
            results.append({
                'url': item.get('url', ''),
                'title': item.get('assetTitle', ''),
                'context': context,
                'type': 'new'
            })
    
    # Similar recommendations
    if 'similar' in data and 'items' in data['similar']:
        for item in data['similar']['items']:
            results.append({
                'url': item.get('url', ''),
                'title': item.get('assetTitle', ''),
                'context': item.get('abstract', 'Similar content'),
                'type': 'similar'
            })
    
    return results