# Build Windows Installer (Single EXE) using Node.js pkg
Write-Host "Building TestFlow Installer (Node.js -> EXE)..." -ForegroundColor Cyan

$InstallerSource = ".\windows-installer\installer.js"
$OutputPath = ".\installers"

if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath | Out-Null
}

# Use npx pkg to compile the JS file into an EXE
# -t node18-win-x64 targets Node 18 on Windows 64-bit
Write-Host "Downloading and running pkg..."
cmd /c "npx -y pkg $InstallerSource -t node18-win-x64 --output $OutputPath\TestFlowInstaller.exe"

if (Test-Path "$OutputPath\TestFlowInstaller.exe") {
    Write-Host "INSTALLER CREATED SUCCESSFULLY: $OutputPath\TestFlowInstaller.exe" -ForegroundColor Green
} else {
    Write-Host "BUILD FAILED." -ForegroundColor Red
}
