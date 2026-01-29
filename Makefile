# Instalação no diretório atual
INSTALL_DIR = $(shell pwd)
SERVICE_FILE = /etc/systemd/system/testflow.service

.PHONY: install uninstall

install:
	@echo "🚀 Configurando TestFlow em: $(INSTALL_DIR)"
	
	@# 1. Verifica Docker
	@command -v docker >/dev/null 2>&1 || { echo >&2 "❌ Docker não encontrado."; exit 1; }
	
	@# 2. Gera docker-compose.yml de produção se não existir
	@if [ ! -f docker-compose.yml ]; then \
		cp docker-compose.prod.yml docker-compose.yml; \
	fi
	
	@# 3. Cria diretório de evidências
	@mkdir -p evidencias_testes
	
	@# 4. Gera e Instala Serviço Systemd Dinâmico
	@echo "🔧 Configurando Serviço Systemd..."
	@echo "[Unit]" > config/testflow.service
	@echo "Description=TestFlow Application Service" >> config/testflow.service
	@echo "Requires=docker.service" >> config/testflow.service
	@echo "After=docker.service" >> config/testflow.service
	@echo "" >> config/testflow.service
	@echo "[Service]" >> config/testflow.service
	@echo "Restart=always" >> config/testflow.service
	@echo "WorkingDirectory=$(INSTALL_DIR)" >> config/testflow.service
	@echo "ExecStartPre=/usr/bin/docker compose down" >> config/testflow.service
	@echo "ExecStart=/usr/bin/docker compose up" >> config/testflow.service
	@echo "ExecStop=/usr/bin/docker compose down" >> config/testflow.service
	@echo "TimeoutStartSec=0" >> config/testflow.service
	@echo "" >> config/testflow.service
	@echo "[Install]" >> config/testflow.service
	@echo "WantedBy=multi-user.target" >> config/testflow.service

	@# Instala o serviço
	@sudo cp config/testflow.service $(SERVICE_FILE)
	@sudo systemctl daemon-reload
	@sudo systemctl enable testflow
	@sudo systemctl start testflow
	
	@echo "✅ Instalação Concluída!"
	@echo "📍 O serviço está rodando a partir de: $(INSTALL_DIR)"
	@echo "   Use 'sudo make uninstall' para remover o serviço."

uninstall:
	@echo "🛑 Removendo Serviço TestFlow..."
	@sudo systemctl stop testflow || true
	@sudo systemctl disable testflow || true
	@sudo rm -f $(SERVICE_FILE)
	@sudo systemctl daemon-reload
	@echo "✅ Serviço removido. (Arquivos mantidos em $(INSTALL_DIR))"
