# ============================================
# TechStore Frontend - Dockerfile
# React app served by nginx
# ============================================

# Stage 1: Build
FROM node:18-alpine AS build

WORKDIR /app

# Build-time environment variable for React
ARG REACT_APP_API_URL=http://localhost:5000/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ARG REACT_APP_CHAT_MODE=v3
ENV REACT_APP_CHAT_MODE=$REACT_APP_CHAT_MODE

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
