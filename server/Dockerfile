FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npm run prisma:generate
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build
EXPOSE 5000
CMD ["sh", "-c", "npm run prisma:deploy && npm start"]
