param([Parameter(Mandatory=$true)][string]$Server, [string]$Code)
$ErrorActionPreference = 'Stop'
if ($Server -notmatch '^https://|^http://(localhost|127\.0\.0\.1):') { throw 'Use the HTTPS URL from your Collector page.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 20 or newer from https://nodejs.org, then try again.' }
$nodeVersion = node -p 'Number(process.versions.node.split(".")[0])'
if ([int]$nodeVersion -lt 20) { throw 'Node.js 20 or newer is required.' }
$installDir = Join-Path $env:USERPROFILE '.token-maxxer'
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
$target = Join-Path $installDir 'collector.cjs'
$temp = Join-Path $installDir 'collector.download'
Invoke-WebRequest -Uri "$Server/collector.cjs" -OutFile $temp
$expected = (Invoke-WebRequest -Uri "$Server/collector.cjs.sha256").Content.Trim().ToLower()
$actual = (Get-FileHash -Path $temp -Algorithm SHA256).Hash.ToLower()
if ($expected -ne $actual) { Remove-Item $temp; throw 'Download verification failed. Retry the command.' }
Move-Item -Path $temp -Destination $target -Force
if ($Code) { node $target setup --server $Server --code $Code } else { node $target setup }
if ($LASTEXITCODE -ne 0) { throw 'Setup did not finish. Review the error above and try again.' }
