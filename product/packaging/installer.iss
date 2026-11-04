; Wispr IDE preview installer. Native per-user install; no publisher signing certificate configured.
#ifndef PackageDir
  #error PackageDir is required
#endif
#ifndef OutputDir
  #error OutputDir is required
#endif
[Setup]
AppId={{C19C384E-BEDA-43FD-9298-79B911F616B4}
AppName=Wispr IDE Preview
AppVersion=0.6.0
AppVerName=Wispr IDE 0.6.0 Preview 2
AppPublisher=Garvit Arora
AppPublisherURL=https://github.com/garvit-arora/whif-ide
AppSupportURL=https://github.com/garvit-arora/whif-ide/issues
DefaultDirName={localappdata}\Programs\Wispr IDE Preview
DefaultGroupName=Wispr IDE Preview
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=Wispr-IDE-Setup-0.6.0-preview.2-x64
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0
UninstallDisplayIcon={app}\Wispr ID.exe
SetupLogging=yes
DisableProgramGroupPage=yes
LicenseFile={#PackageDir}\resources\app\LICENSE.txt
[Tasks]
Name: desktopicon; Description: Create a desktop shortcut; Flags: unchecked
[Files]
Source: "{#PackageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{autoprograms}\Wispr IDE Preview"; Filename: "{app}\Wispr ID.exe"
Name: "{autodesktop}\Wispr IDE Preview"; Filename: "{app}\Wispr ID.exe"; Tasks: desktopicon
[Run]
Filename: "{app}\Wispr ID.exe"; Description: Launch Wispr IDE Preview; Flags: nowait postinstall skipifsilent
[Code]
function FlowInstalled(): Boolean;
var
  Root: String;
  Entry: TFindRec;
begin
  Root := ExpandConstant('{localappdata}\WisprFlow');
  Result := FileExists(Root + '\Wispr Flow.exe');
  if not Result and FindFirst(Root + '\app-*', Entry) then
  begin
    try
      repeat
        if FileExists(Root + '\' + Entry.Name + '\Wispr Flow.exe') then
          Result := True;
      until Result or not FindNext(Entry);
    finally
      FindClose(Entry);
    end;
  end;
end;
function InitializeSetup(): Boolean;
var
  ErrorCode: Integer;
begin
  Result := FlowInstalled();
  if not Result then
  begin
    if MsgBox('Official Wispr Flow is required. Install it first, then run this setup again. Open its official download page?', mbInformation, MB_YESNO) = IDYES then
      ShellExec('open', 'https://wisprflow.ai/download', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
  end;
end;
