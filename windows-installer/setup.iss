[Setup]
AppName=TestFlow
AppVersion=1.0.0
AppPublisher=TestFlow Inc.
AppPublisherURL=https://github.com/JoaoVictor-M/testflow
DefaultDirName={pf}\TestFlow
DefaultGroupName=TestFlow
OutputBaseFilename=TestFlow_Setup_v1.0.0
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
; Copy docker-compose.prod.yml (renamed to docker-compose.yml)
Source: "..\docker-compose.prod.yml"; DestDir: "{app}"; DestName: "docker-compose.yml"; Flags: ignoreversion
; Copy mongo-init.js
Source: "..\mongo-init.js"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Iniciar TestFlow"; Filename: "cmd.exe"; Parameters: "/k cd /d ""{app}"" && docker compose up -d && start http://localhost"
Name: "{group}\Parar TestFlow"; Filename: "cmd.exe"; Parameters: "/k cd /d ""{app}"" && docker compose down"
Name: "{group}\Desinstalar TestFlow"; Filename: "{uninstallexe}"

[Run]
Filename: "{cmd}"; Parameters: "/c docker info"; StatusMsg: "Verificando instalação do Docker..."; Flags: runhidden waituntilterminated; Check: DockerNotInstalled

[Code]
function DockerNotInstalled: Boolean;
var
  ResultCode: Integer;
begin
  if Exec('cmd.exe', '/c docker info', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    Result := (ResultCode <> 0)
  else
    Result := True;
end;

procedure InitializeWizard;
begin
  if DockerNotInstalled then
  begin
    MsgBox('O Docker não foi detectado no sistema.' #13#13 'O TestFlow requer o Docker Desktop para funcionar. Por favor, instale o Docker e tente novamente.', mbCriticalError, MB_OK);
  end;
end;

[UninstallRun]
Filename: "cmd.exe"; Parameters: "/c docker compose down"; WorkingDir: "{app}"; Flags: runhidden
