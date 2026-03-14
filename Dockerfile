FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci

COPY shared ./shared
COPY server ./server
COPY client ./client
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app/public
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
# Point the shared workspace package at built JavaScript inside the runtime image.
RUN node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('shared/package.json', 'utf8')); pkg.main = 'dist/src/index.js'; fs.writeFileSync('shared/package.json', JSON.stringify(pkg, null, 2) + '\n');"
RUN npm ci --omit=dev --workspace shared --workspace server && npm cache clean --force

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/client/dist ./client/dist
RUN mkdir -p server && ln -s ../client ./server/client

EXPOSE 2567
CMD ["node", "server/dist/src/index.js"]
