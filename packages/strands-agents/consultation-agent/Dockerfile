FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim
WORKDIR /app

# All environment variables in one layer
ENV UV_SYSTEM_PYTHON=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_NO_PROGRESS=1 \
    PYTHONUNBUFFERED=1 \
    DOCKER_CONTAINER=1 \
    AWS_REGION=ap-northeast-2 \
    AWS_DEFAULT_REGION=ap-northeast-2 \
    BEDROCK_AGENTCORE_MEMORY_ID=prechatConsultationAgent_mem-Rk4j5aB6Sa \
    BEDROCK_AGENTCORE_MEMORY_NAME=prechatConsultationAgent_mem



COPY requirements.txt requirements.txt
# Install from requirements file
RUN uv pip install -r requirements.txt




RUN uv pip install aws-opentelemetry-distro>=0.10.1

# AWS Documentation MCP 서버를 빌드 시점에 사전 설치 (콜드 스타트 방지)
RUN uv tool install awslabs.aws-documentation-mcp-server

# Signal that this is running in Docker for host binding logic
ENV DOCKER_CONTAINER=1

# Create non-root user
RUN useradd -m -u 1000 bedrock_agentcore

# uvx 도구 디렉토리를 non-root 유저에게 이전
RUN mkdir -p /home/bedrock_agentcore/.local/share && \
    cp -r /root/.local/share/uv /home/bedrock_agentcore/.local/share/uv && \
    chown -R bedrock_agentcore:bedrock_agentcore /home/bedrock_agentcore/.local

USER bedrock_agentcore

EXPOSE 9000
EXPOSE 8000
EXPOSE 8080

# Copy entire project (respecting .dockerignore)
COPY . .

# Use the full module path

CMD ["opentelemetry-instrument", "python", "-m", "agent"]
