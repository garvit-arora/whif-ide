# Copyright (c) Microsoft Corporation. Licensed under the MIT License.
param([string]$IdeExe, [string]$FlowRoot, [string]$Hotkey = 'Ctrl+Win', [int]$ParentPid, [switch]$SelfTest)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -Path (Join-Path $PSScriptRoot 'FlowWatcher.cs') -ReferencedAssemblies 'System.Windows.Forms','System.Drawing','System.Web.Extensions','System.Core'
if ($SelfTest) {
    $keys = [Wispr.FlowWatcher]::ParseKeys($Hotkey)
    @{ type = 'self-test'; keys = @($keys); passed = $keys.Length -gt 0 } | ConvertTo-Json -Compress
    exit
}
[Wispr.FlowWatcher]::Run($IdeExe, $FlowRoot, $Hotkey, $ParentPid)
