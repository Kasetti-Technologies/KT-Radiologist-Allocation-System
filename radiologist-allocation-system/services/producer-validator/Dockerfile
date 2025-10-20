# services/producer-validator/Dockerfile

FROM node:20-alpine
WORKDIR /app

COPY services/producer-validator/package*.json ./
RUN npm install

# ✅ Now this path works, because schemas/ is visible within context (root)
COPY schemas ./schemas

# ✅ Copy the validator service source code
COPY services/producer-validator ./ 

EXPOSE 8081
CMD ["npm", "start"]