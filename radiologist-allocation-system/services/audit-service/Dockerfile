# services/audit-service/Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY . .

RUN npm install

EXPOSE 8085

CMD ["npm", "start"]
