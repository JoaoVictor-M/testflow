@echo off
pushd %~dp0..

echo ========================================================
echo   TestFlow - Build e Publish de Imagens (GHCR)
echo ========================================================
echo.

echo 1. Fazendo Login no GHCR (GitHub Container Registry)...
echo    Certifique-se de que voce ja fez login com: docker login ghcr.io -u SEU_USUARIO -p SEU_TOKEN
echo.

echo 2. Construindo Imagens...
docker build -t ghcr.io/joaovictor-m/testflow-backend:v1.0.0 -t ghcr.io/joaovictor-m/testflow-backend:latest ./testflow-app
docker build -t ghcr.io/joaovictor-m/testflow-frontend:v1.0.0 -t ghcr.io/joaovictor-m/testflow-frontend:latest ./testflow-frontend

echo.
echo 3. Enviando para o GHCR...
docker push ghcr.io/joaovictor-m/testflow-backend:v1.0.0
docker push ghcr.io/joaovictor-m/testflow-backend:latest
docker push ghcr.io/joaovictor-m/testflow-frontend:v1.0.0
docker push ghcr.io/joaovictor-m/testflow-frontend:latest

echo.
echo ========================================================
echo   Processo Concluido!
echo ========================================================
pause
