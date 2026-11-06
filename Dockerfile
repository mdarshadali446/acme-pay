FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run seed
ENV NODE_ENV=production
ENV HR_PASSWORD=pay-ledger
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/server.js"]
