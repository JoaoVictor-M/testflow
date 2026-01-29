const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\x1b[36m%s\x1b[0m', '🚀 TestFlow Installer (v1.0.0)');

// 1. Check Docker
try {
    execSync('docker --version', { stdio: 'ignore' });
} catch (e) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Docker not found! Please install Docker Desktop first.');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', process.exit.bind(process, 1));
    return;
}

const installDir = 'C:\\TestFlow';

// 2. Create Directory
if (!fs.existsSync(installDir)) {
    console.log(`📂 Creating directory: ${installDir}`);
    fs.mkdirSync(installDir, { recursive: true });
}

// 3. Write Config Files
console.log('📝 Writing configuration files...');

const updateImage = (content) => {
    // Ensure we are using remote images, not local builds
    return content;
};

const dockerComposeContent = `services:
  mongodb-service:
    image: mongo:latest
    container_name: mongodb_testflow
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro

  backend-service:
    image: ghcr.io/joaovictor-m/testflow-backend:v1.0.0
    container_name: backend_testflow
    restart: always
    ports:
      - "3000:3000"
    volumes:
      - ./evidencias_testes:/evidencias_testes
    depends_on:
      - mongodb-service
    environment:
      - MONGODB_URI=mongodb://mongodb-service:27017/testflow

  frontend-service:
    image: ghcr.io/joaovictor-m/testflow-frontend:v1.0.0
    container_name: frontend_testflow
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend-service

volumes:
  mongo-data:
`;

const mongoInitContent = `db = db.getSiblingDB('testflow');
db.createCollection('users');
db.createCollection('projects');
`;

fs.writeFileSync(path.join(installDir, 'docker-compose.yml'), dockerComposeContent);
fs.writeFileSync(path.join(installDir, 'mongo-init.js'), mongoInitContent);

// 4. Run Docker Compose
console.log('\x1b[33m%s\x1b[0m', '🐳 Starting TestFlow containers...');
try {
    process.chdir(installDir);
    execSync('docker compose pull', { stdio: 'inherit' });
    execSync('docker compose up -d', { stdio: 'inherit' });
    console.log('\x1b[32m%s\x1b[0m', '\n✅ Installation Complete!');
    console.log('\x1b[32m%s\x1b[0m', '📍 Access at: http://localhost');
} catch (e) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Installation Failed: ' + e.message);
}

console.log('\nPress any key to exit...');
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', process.exit.bind(process, 0));
