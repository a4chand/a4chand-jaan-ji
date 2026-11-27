# Railway: this repo has no package.json, so Railway's default builder
# produces an image without Node. This Dockerfile provides Node 24
# and runs the prebuilt bundle exactly as render.yaml does.
FROM node:24
WORKDIR /app
COPY . .
EXPOSE 5000
CMD ["node", "server.mjs"]
