# Use official Node.js LTS (Bookworm slim includes Debian package manager for ffmpeg)
FROM node:22-bookworm-slim

# Install ffmpeg for MP3 encoding and audio concatenation
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Build the client Web App PWA frontend
RUN npm run build

# Default environment variables (Render automatically injects PORT)
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Start production server
CMD ["npm", "start"]
