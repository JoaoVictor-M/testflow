@echo off
pushd %~dp0..

echo ========================================================
echo   TestFlow - Build e Publish de Imagens (GHCR)
echo ========================================================
echo.

echo.
set /p NEW_VERSION="Digite a nova versao (ex: 1.0.1): "
echo.

echo 0. Atualizando versao no package.json...
cd testflow-app
call npm version %NEW_VERSION% --no-git-tag-version --allow-same-version
cd ..
echo.

echo 1. Fazendo Login no GHCR (GitHub Container Registry)...
echo    Certifique-se de que voce ja fez login com: docker login ghcr.io -u SEU_USUARIO -p SEU_TOKEN
echo.

echo 2. Construindo Imagens (v%NEW_VERSION%)...
docker build -t ghcr.io/joaovictor-m/testflow-backend:v%NEW_VERSION% -t ghcr.io/joaovictor-m/testflow-backend:latest ./testflow-app
docker build -t ghcr.io/joaovictor-m/testflow-frontend:v%NEW_VERSION% -t ghcr.io/joaovictor-m/testflow-frontend:latest ./testflow-frontend

echo.
echo 3. Enviando para o GHCR...
docker push ghcr.io/joaovictor-m/testflow-backend:v%NEW_VERSION%
docker push ghcr.io/joaovictor-m/testflow-backend:latest
docker push ghcr.io/joaovictor-m/testflow-frontend:v%NEW_VERSION%
docker push ghcr.io/joaovictor-m/testflow-frontend:latest
echo.

echo 4. Atualizando repositorio de instalacao (Publico)...
echo Lembre-se de atualizar o docker-compose.yml publico se necessario (embora use latest/tag, e bom manter alinhado).
echo.

echo ========================================================
echo   Processo Concluido! Versao %NEW_VERSION% publicada.
echo ========================================================
pause
