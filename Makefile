INSTALL_DIR = /opt/testflow
SERVICE_FILE = /etc/systemd/system/testflow.service

.PHONY: install uninstall

install:
	@echo "🚀 Installing TestFlow..."
	
	@# 1. Check prerequisites
	@command -v docker >/dev/null 2>&1 || { echo >&2 "❌ Docker is required but not installed. Aborting."; exit 1; }
	
	@# 2. Prepare Directory
	@mkdir -p $(INSTALL_DIR)
	@cp docker-compose.prod.yml $(INSTALL_DIR)/docker-compose.yml
	@cp mongo-init.js $(INSTALL_DIR)/mongo-init.js
	
	@# 3. Create Volumes Directory
	@mkdir -p $(INSTALL_DIR)/evidencias_testes
	
	@# 4. Install Systemd Service
	@echo "🔧 Configuring Systemd Service..."
	@cp config/testflow.service $(SERVICE_FILE)
	@systemctl daemon-reload
	@systemctl enable testflow
	@systemctl start testflow
	
	@echo "✅ TestFlow installed successfully!"
	@echo "📍 URL: http://localhost"
	@echo "📂 Location: $(INSTALL_DIR)"

uninstall:
	@echo "🛑 Uninstalling TestFlow..."
	@systemctl stop testflow || true
	@systemctl disable testflow || true
	@rm -f $(SERVICE_FILE)
	@systemctl daemon-reload
	@rm -rf $(INSTALL_DIR)
	@echo "✅ Uninstalled."
