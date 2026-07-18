FROM node:22-alpine

ARG APP_VERSION=0.2.3

LABEL org.opencontainers.image.source="https://github.com/rhhyun/Diabetic-foot_Screening-Wiregene-demo" \
      org.opencontainers.image.description="Wiregene diabetic-foot screening demo" \
      org.opencontainers.image.version="${APP_VERSION}"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    APP_VERSION=${APP_VERSION}

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node *.html *.mjs *.js *.css ./
COPY --chown=node:node api ./api
COPY --chown=node:node server ./server

USER node

EXPOSE 3000
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(async r=>{const b=await r.json();if(!r.ok||b.ok!==true)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "server.mjs"]
