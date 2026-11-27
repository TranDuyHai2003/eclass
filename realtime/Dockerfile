FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY *.mjs ./
ENV PORT=2567 DATA_DIR=/app/data
EXPOSE 2567
CMD ["node", "server.mjs"]
