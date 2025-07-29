FROM node:20-slim

# Install system utilities including procps (which provides pgrep)
RUN apt-get update && apt-get install -y \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./
COPY packages/core/package.json ./packages/core/

# Install dependencies including build tools
RUN npm install

# Install core package dependencies
RUN cd packages/core && npm install

# Copy source code
COPY packages/ ./packages/

# Create a simple build script for the server using esbuild
RUN npx esbuild packages/engine/server/server.ts --bundle --outfile=server.js --platform=node --format=esm \
    --external:express \
    --external:get-port \
    --external:@google/genai \
    --external:diff \
    --external:gaxios \
    --external:undici \
    --external:google-auth-library \
    --external:open \
    --external:@opentelemetry/api-logs \
    --external:@opentelemetry/semantic-conventions \
    --external:simple-git \
    --external:@opentelemetry/api \
    --external:@opentelemetry/exporter-trace-otlp-grpc \
    --external:@opentelemetry/exporter-logs-otlp-grpc \
    --external:@opentelemetry/exporter-metrics-otlp-grpc \
    --external:@opentelemetry/otlp-exporter-base \
    --external:@opentelemetry/sdk-node \
    --external:@opentelemetry/resources \
    --external:@opentelemetry/sdk-trace-node \
    --external:@opentelemetry/sdk-logs \
    --external:@opentelemetry/sdk-metrics \
    --external:@opentelemetry/instrumentation-http \
    --external:html-to-text \
    --external:@modelcontextprotocol/sdk/client/index.js \
    --external:@modelcontextprotocol/sdk/client/stdio.js \
    --external:@modelcontextprotocol/sdk/client/sse.js \
    --external:@modelcontextprotocol/sdk/client/streamableHttp.js \
    --external:mime-types \
    --external:path \
    --external:fs \
    --external:os \
    --external:util \
    --external:crypto \
    --external:stream \
    --external:buffer

# Expose the port (container always uses 5000 internally)
EXPOSE 5000

# Set default port for the container (can be overridden at runtime)
ENV PORT=5000

# Start the server
CMD ["node", "server.js"]