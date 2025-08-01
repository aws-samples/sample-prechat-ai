# Design Document

## Overview

The AWS Documentation MCP Server is a Lambda-based implementation that provides Bedrock Agents with access to AWS Documentation through the Model Context Protocol (MCP). The server will be integrated into the existing MTE Pre-consultation Chatbot monorepo, following established patterns and leveraging the existing AWS SAM infrastructure.

The system implements three core tools: documentation search, page reading with markdown conversion, and related content recommendations. All communication follows the MCP protocol specification, ensuring compatibility with Bedrock Agents and other MCP clients.

## Architecture

### High-Level Architecture

```
[Bedrock Agent] 
    ↓ (MCP Protocol over HTTP)
[API Gateway]
    ↓ (Lambda Proxy Integration)
[Lambda Function - MCP Server]
    ↓ (HTTP Requests)
[AWS Documentation API]
```

### Component Architecture

```
packages/backend/
├── mcp_docs_handler.py          # Lambda handler (follows existing pattern)
├── mcp/                         # MCP server implementation
│   ├── __init__.py
│   ├── server.py               # Core MCP server logic
│   ├── documentation_client.py # AWS Docs API client
│   └── tools/                  # MCP tools implementation
│       ├── __init__.py
│       ├── search_docs.py      # Search tool
│       ├── read_docs.py        # Read tool
│       └── recommend_docs.py   # Recommend tool
└── utils.py                    # Existing utilities (extended)
```

### Integration with Existing Infrastructure

The MCP server will be added to the existing `template.yaml` SAM configuration, following the established pattern of other handlers in the monorepo. It will reuse existing utilities and follow the same deployment and monitoring patterns.

## Components and Interfaces

### 1. Lambda Handler (mcp_docs_handler.py)

**Purpose:** Entry point for Lambda function, handles HTTP requests and MCP protocol routing.

**Key Responsibilities:**
- HTTP request/response handling
- CORS management
- MCP server instance management (singleton pattern for container reuse)
- Error handling and logging
- Async event loop management

**Interface:**
```python
def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Handles incoming HTTP requests and routes them to MCP server
    
    Args:
        event: API Gateway event
        context: Lambda context
        
    Returns:
        HTTP response with MCP protocol data
    """
```

### 2. MCP Server (mcp/server.py)

**Purpose:** Core MCP protocol implementation and request routing.

**Key Responsibilities:**
- MCP protocol message handling
- Tool registration and management
- Request validation and routing
- Response formatting

**Interface:**
```python
class MCPDocumentationServer:
    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]
    async def _handle_initialize(self, request: Dict[str, Any]) -> Dict[str, Any]
    async def _handle_tools_list(self, request: Dict[str, Any]) -> Dict[str, Any]
    async def _handle_tools_call(self, request: Dict[str, Any]) -> Dict[str, Any]
```

### 3. Documentation Client (mcp/documentation_client.py)

**Purpose:** HTTP client for interacting with AWS Documentation APIs and web pages.

**Key Responsibilities:**
- HTTP session management with connection pooling
- AWS Documentation search API integration
- HTML content fetching and parsing
- Content conversion (HTML to Markdown)
- Related link extraction

**Interface:**
```python
class AWSDocumentationClient:
    async def search_documentation(self, query: str, limit: int) -> List[Dict[str, Any]]
    async def read_documentation(self, url: str, max_length: int, start_index: int) -> str
    async def get_recommendations(self, url: str) -> List[Dict[str, Any]]
```

### 4. MCP Tools

#### Search Tool (mcp/tools/search_docs.py)
- Implements AWS documentation search functionality
- Validates search parameters
- Returns structured search results

#### Read Tool (mcp/tools/read_docs.py)
- Fetches and converts documentation pages to markdown
- Implements content pagination
- Validates AWS documentation URLs

#### Recommend Tool (mcp/tools/recommend_docs.py)
- Extracts related documentation links
- Provides content recommendations
- Filters and formats recommendation results

## Data Models

### MCP Protocol Messages

```python
# Initialize Request
{
    "jsonrpc": "2.0",
    "id": int,
    "method": "initialize",
    "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": str, "version": str}
    }
}

# Tool Call Request
{
    "jsonrpc": "2.0",
    "id": int,
    "method": "tools/call",
    "params": {
        "name": str,
        "arguments": Dict[str, Any]
    }
}
```

### Tool Schemas

```python
# Search Tool Schema
{
    "type": "object",
    "properties": {
        "search_phrase": {"type": "string"},
        "limit": {"type": "integer", "default": 10, "minimum": 1, "maximum": 50}
    },
    "required": ["search_phrase"]
}

# Read Tool Schema
{
    "type": "object",
    "properties": {
        "url": {"type": "string"},
        "max_length": {"type": "integer", "default": 5000},
        "start_index": {"type": "integer", "default": 0}
    },
    "required": ["url"]
}

# Recommend Tool Schema
{
    "type": "object",
    "properties": {
        "url": {"type": "string"}
    },
    "required": ["url"]
}
```

### Response Models

```python
# Search Results
{
    "search_phrase": str,
    "results": [
        {
            "rank_order": int,
            "url": str,
            "title": str,
            "context": str
        }
    ],
    "total_results": int
}

# Documentation Content
{
    "url": str,
    "content": str,  # Markdown formatted
    "max_length": int,
    "start_index": int
}

# Recommendations
{
    "url": str,
    "recommendations": [
        {
            "url": str,
            "title": str,
            "context": str
        }
    ],
    "total_recommendations": int
}
```

## Error Handling

### Error Categories

1. **Protocol Errors:** Invalid MCP requests, unsupported methods
2. **Validation Errors:** Invalid parameters, malformed URLs
3. **External API Errors:** AWS Documentation API failures, network timeouts
4. **System Errors:** Lambda timeouts, memory limits, unexpected exceptions

### Error Response Format

```python
{
    "id": request_id,
    "error": {
        "code": int,  # JSON-RPC error codes
        "message": str,
        "data": Optional[Dict[str, Any]]
    }
}
```

### Error Handling Strategy

- **Graceful Degradation:** Return partial results when possible
- **Retry Logic:** Implement exponential backoff for transient failures
- **Circuit Breaker:** Prevent cascading failures from external APIs
- **Detailed Logging:** Comprehensive error logging for debugging
- **User-Friendly Messages:** Clear error messages for tool users

## Testing Strategy

### Unit Testing

- **Tool Testing:** Individual tool functionality and validation
- **Client Testing:** HTTP client methods with mocked responses
- **Server Testing:** MCP protocol message handling
- **Handler Testing:** Lambda handler with various event types

### Integration Testing

- **End-to-End MCP Flow:** Complete request/response cycles
- **AWS Documentation API:** Real API interactions with rate limiting
- **Error Scenarios:** Network failures, invalid responses, timeouts

### Performance Testing

- **Cold Start Optimization:** Lambda initialization time measurement
- **Memory Usage:** Content processing and caching efficiency
- **Concurrent Requests:** Multiple simultaneous tool calls
- **Large Content Handling:** Documentation pages with extensive content

### Test Data

- **Sample Queries:** Common AWS service searches
- **Documentation URLs:** Representative AWS documentation pages
- **Edge Cases:** Invalid URLs, empty responses, malformed content

## Security Considerations

### Input Validation

- **URL Whitelist:** Only allow docs.aws.amazon.com domain
- **Parameter Validation:** Strict schema validation for all inputs
- **Content Length Limits:** Prevent memory exhaustion attacks
- **Query Sanitization:** Clean search queries to prevent injection

### Network Security

- **HTTPS Only:** All external requests use HTTPS
- **CORS Configuration:** Appropriate CORS headers for API Gateway
- **Rate Limiting:** API Gateway throttling configuration
- **Timeout Controls:** Prevent long-running requests

### Data Privacy

- **No Sensitive Data Storage:** No persistent storage of user queries
- **Logging Controls:** Avoid logging sensitive information
- **Content Filtering:** Remove any potentially sensitive content from responses

## Performance Optimization

### Lambda Optimization

- **Container Reuse:** Global variables for connection pooling
- **Memory Configuration:** Optimal memory allocation (512MB)
- **Timeout Settings:** Appropriate timeout values (30 seconds)
- **Cold Start Mitigation:** Lazy initialization patterns

### HTTP Client Optimization

- **Connection Pooling:** Reuse HTTP connections with aiohttp
- **Request Caching:** Cache frequently requested documentation
- **Compression:** Enable gzip compression for responses
- **Concurrent Requests:** Parallel processing where applicable

### Content Processing

- **Streaming Processing:** Process large documents in chunks
- **Efficient Parsing:** Optimized HTML to Markdown conversion
- **Memory Management:** Proper cleanup of large content objects

## Monitoring and Observability

### CloudWatch Metrics

- **Request Count:** Total MCP requests processed
- **Tool Usage:** Individual tool execution counts
- **Error Rates:** Error percentages by type
- **Response Times:** Latency metrics for each tool
- **Memory Usage:** Lambda memory consumption patterns

### Logging Strategy

- **Structured Logging:** JSON formatted logs for easy parsing
- **Request Tracing:** Unique request IDs for correlation
- **Performance Metrics:** Execution time for each component
- **Error Details:** Comprehensive error information with context

### Alerting

- **High Error Rates:** Alert on error rate thresholds
- **Performance Degradation:** Alert on increased latency
- **External API Failures:** Alert on AWS Documentation API issues
- **Resource Limits:** Alert on memory or timeout issues

## Deployment Configuration

### SAM Template Integration

The MCP server will be added to the existing `template.yaml` with the following configuration:

```yaml
MCPDocsFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: packages/backend/
    Handler: mcp_docs_handler.lambda_handler
    Runtime: python3.13
    MemorySize: 512
    Timeout: 30
    Environment:
      Variables:
        PYTHONPATH: /var/task
    Events:
      MCPApi:
        Type: Api
        Properties:
          Path: /mcp/docs
          Method: post
      MCPOptions:
        Type: Api
        Properties:
          Path: /mcp/docs
          Method: options
```

### Dependencies

New dependencies will be added to `packages/backend/requirements.txt`:
- `aiohttp>=3.9.1` - Async HTTP client
- `beautifulsoup4>=4.12.0` - HTML parsing (if needed)
- `html2text>=2020.1.16` - HTML to Markdown conversion

### Environment Variables

- `MCP_DOCS_CACHE_TTL`: Cache time-to-live for documentation content
- `MCP_DOCS_MAX_CONTENT_LENGTH`: Maximum content length per request
- `MCP_DOCS_REQUEST_TIMEOUT`: HTTP request timeout in seconds