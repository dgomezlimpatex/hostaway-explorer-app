param([Parameter(Mandatory=$true)][ValidateSet('limpatexconsultor','limpatexoperaciones','limpatexrentabilidad','limpatexcomercial')][string]$Profile)
$ErrorActionPreference = 'Stop'
$readRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$readDescriptor = & (Join-Path $readRoot 'bin/hermes.cmd') --print-runtime-command
if ($LASTEXITCODE -ne 0) { throw 'No se pudo resolver el runtime de Hermes.' }
$readCommand = ($readDescriptor -join "`n") | ConvertFrom-Json
$env:HERMES_HOME = Join-Path $readRoot "profiles/$Profile"
& ([string]$readCommand[0]) (Join-Path $PSScriptRoot 'mcp_server.py') --profile $Profile
exit $LASTEXITCODE
