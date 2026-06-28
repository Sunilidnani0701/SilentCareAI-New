FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY . .

# Set default client-side API URL pointing to localhost backend
ARG NEXT_PUBLIC_API_URL=https://back.silentcareai.eu.cc
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "run", "start"]
