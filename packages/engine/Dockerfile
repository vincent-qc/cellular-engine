FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./

# Install dependencies including build tools
RUN npm install

# Copy source code
COPY packages/ ./packages/

# Create a simple build script for the server using esbuild
RUN npx esbuild packages/engine/server/server.ts --bundle --outfile=server.js --platform=node --format=esm --external:express --external:get-port

# Expose the port
EXPOSE 5000

# Set default port if not provided
ENV PORT=5000

# Start the server
CMD ["node", "server.js"]
