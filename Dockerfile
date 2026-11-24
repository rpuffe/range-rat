# Zero-dependency Node server (plain node:http + node:crypto, including the
# S3 saves), so there is no npm install: the image is the current slim Node
# base plus our files.
FROM node:22-alpine

# apk upgrade: official base images lag CVE fixes by days, and the Trivy gate
# fails on fixable HIGH/CRITICAL vulns. Keep this line (docs/dockerfile.md).
RUN apk upgrade --no-cache

# Nothing here ever runs npm, and the npm CLI that node:22-alpine ships carries
# its own vulnerable transitive deps that trip the scan gate. Remove the
# package managers rather than chase CVEs in code we never run.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn*

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY web ./web

ENV PORT=8080
EXPOSE 8080

# node:22-alpine ships a non-root "node" user; name it explicitly so the
# Dockerfile itself satisfies the non-root scan check (Trivy DS002).
USER node

CMD ["node", "server/server.mjs"]
