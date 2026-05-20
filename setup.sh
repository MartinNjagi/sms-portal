#!/usr/bin/env bash

# =========================================================
# Node.js BFF Architecture Scaffold Generator
# =========================================================

set -e

echo "🚀 Creating project structure..."

# Root files
touch .env
touch server.js
touch package.json

# =========================================================
# SRC
# =========================================================

mkdir -p src/config
mkdir -p src/middlewares
mkdir -p src/services

mkdir -p src/modules/dashboard
mkdir -p src/modules/messages
mkdir -p src/modules/clients
mkdir -p src/modules/auth

# Config files
touch src/config/cloudStorage.js
touch src/config/axiosClient.js

# Middleware files
touch src/middlewares/requireAuth.js
touch src/middlewares/errorHandler.js

# Services
touch src/services/goEngineWrapper.js

# Dashboard module
touch src/modules/dashboard/dashboard.routes.js
touch src/modules/dashboard/dashboard.controller.js

# Messages module
touch src/modules/messages/message.routes.js
touch src/modules/messages/message.controller.js

# Clients module
touch src/modules/clients/client.routes.js
touch src/modules/clients/client.controller.js

# Auth module
touch src/modules/auth/auth.routes.js
touch src/modules/auth/auth.controller.js

# =========================================================
# VIEWS
# =========================================================

mkdir -p views/partials
mkdir -p views/message
mkdir -p views/dashboard

touch views/layout-v2.njk

# Message templates
touch views/message/bulk.njk
touch views/message/index.njk

# =========================================================
# PUBLIC
# =========================================================

mkdir -p public/js/customjs
mkdir -p public/js/vue-components

mkdir -p public/css
mkdir -p public/assets

touch public/js/websocket-client.js

# =========================================================
# OPTIONAL: Starter Boilerplate Content
# =========================================================

cat > server.js << 'EOF'
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('BFF Server Running');
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
EOF

cat > package.json << 'EOF'
{
  "name": "node-bff-app",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "axios": "^1.6.8",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "nunjucks": "^3.2.4",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
EOF

echo "✅ Project scaffold created successfully!"