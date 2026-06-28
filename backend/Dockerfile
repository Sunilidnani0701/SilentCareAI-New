# Use official Python lightweight image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies (needed for audio/video processing if applicable)
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Render sets PORT dynamically, default to 8000)
EXPOSE 8000

# Run the FastAPI server using Uvicorn
CMD ["sh", "-c", "uvicorn main_fastapi:app --host 0.0.0.0 --port ${PORT:-8000}"]
