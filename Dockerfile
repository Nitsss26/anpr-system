# Multi-stage build for production
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production

COPY frontend/ ./
RUN npm run build

# Backend with Python
FROM node:18-alpine AS backend

# Install Python and system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    build-base \
    linux-headers \
    ffmpeg \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgtk-3-0

WORKDIR /app

# Copy backend files
COPY backend/package*.json ./
RUN npm ci --only=production

# Install Python dependencies
COPY backend/python/requirements.txt ./python/
RUN pip3 install -r python/requirements.txt

# Copy backend source
COPY backend/ ./

# Copy frontend build
COPY --from=frontend-build /app/frontend/build ./public

# Create necessary directories
RUN mkdir -p uploads/videos temp logs python/models

# Setup Python models
RUN python3 python/setup_models.py

EXPOSE 5000

CMD ["npm", "start"]
