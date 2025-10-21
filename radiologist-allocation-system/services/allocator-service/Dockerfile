# services/allocator-service/Dockerfile
FROM node:20-alpine
WORKDIR /app

COPY services/allocator-service/package*.json ./
RUN npm install

COPY services/allocator-service ./

EXPOSE 8082
CMD ["npm", "start"]
