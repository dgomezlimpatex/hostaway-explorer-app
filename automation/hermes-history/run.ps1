param(
  [ValidateSet('refresh','status','mcp','query','record')][string]$Action = 'status',
  [ValidateSet('limpatexconsultor','limpatexoperaciones','limpatexrentabilidad')][string]$Profile = 'limpatexoperaciones',
  [switch]$Force,
  [ValidateSet('resumen','trabajador','edificio','propiedad')][string]$Query = 'resumen',
  [string]$Id = '',
  [string]$Search = '',
  [int]$Limit = 20,
  [int]$Offset = 0
)
$ErrorActionPreference = 'Stop'
$historyRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$descriptor = & (Join-Path $historyRoot 'bin/hermes.cmd') --print-runtime-command
if ($LASTEXITCODE -ne 0) { throw 'No se pudo resolver Python de Hermes.' }
$runtime = ($descriptor -join "`n") | ConvertFrom-Json
if ($Action -eq 'mcp') {
  & ([string]$runtime[0]) (Join-Path $PSScriptRoot 'mcp_server.py') --profile $Profile
} else {
  $historyArgs = @((Join-Path $PSScriptRoot 'history_runtime.py'), $Action)
  if ($Force) { $historyArgs += '--force' }
  if ($Action -eq 'query') {
    $historyArgs += @('--profile',$Profile,'--query',$Query,'--limit',[string]$Limit,'--offset',[string]$Offset)
    if ($Id) { $historyArgs += @('--id',$Id) }
    if ($Search) { $historyArgs += @('--search',$Search) }
  }
  & ([string]$runtime[0]) @historyArgs
}
exit $LASTEXITCODE
