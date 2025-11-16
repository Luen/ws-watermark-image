# Use Node.js LTS version as base image
FROM node:20-slim

# Install system dependencies required for Sharp (image processing library)
# Sharp uses prebuilt binaries, so we only need the runtime library
RUN apt-get update && apt-get install -y \
    libvips \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY index.js ./
COPY Wanderstories-logo.png ./
COPY favicon.ico ./

# Create content/images directory for storing processed images
RUN mkdir -p content/images

# Expose the port the app runs on
EXPOSE 8080

# Run the application
CMD ["node", "index.js"]

