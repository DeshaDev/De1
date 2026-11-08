# Creates the complete cPanel deployment ZIP (including server.js, app_wrapper.cjs, dist, package files, and instructions)
$ErrorActionPreference = "Stop"

Write-Host "1. Building production client and server..."
npm run build

Write-Host "2. Assembling cPanel deployment package..."
$tempDir = "cpanel-package-temp"
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
New-Item -ItemType Directory -Path $tempDir | Out-Null

Copy-Item "server.js" "$tempDir\server.js"
Copy-Item "app_wrapper.cjs" "$tempDir\app_wrapper.cjs"
Copy-Item "package.json" "$tempDir\package.json"
Copy-Item "package-lock.json" "$tempDir\package-lock.json"
Copy-Item "docs\DEPLOY_CPANEL_AR.md" "$tempDir\DEPLOY_CPANEL_AR.md"

$readmeContent = @"
Haya Naqra cPanel Node.js deployment package.
==============================================
Read DEPLOY_CPANEL_AR.md before extracting.
Startup file in cPanel: app_wrapper.cjs
Node.js version: 22

Extract all contents inside your application root (e.g. /home/user/hayanaqra-app).
Do not deploy dist alone as a static website; the app requires the Node.js API server.
"@
Set-Content -Path "$tempDir\README-START-HERE.txt" -Value $readmeContent -Encoding UTF8

Copy-Item -Path "dist" -Destination "$tempDir\dist" -Recurse -Force

$zipPath = "hayanaqra-cpanel-deploy.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

Write-Host "3. Compressing into $zipPath..."
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
Remove-Item -Recurse -Force $tempDir

$file = Get-Item $zipPath
Write-Host "Success! Created $zipPath ($([math]::Round($file.Length / 1MB, 2)) MB)"
