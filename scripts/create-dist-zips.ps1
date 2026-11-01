$ErrorActionPreference = "Stop"

Write-Host "Creating lightweight dist (without audio)..."
$tempLight = "dist-light-temp"
if (Test-Path $tempLight) { Remove-Item -Recurse -Force $tempLight }
New-Item -ItemType Directory -Path $tempLight | Out-Null

Get-ChildItem -Path dist | Where-Object { $_.Name -ne "audio" } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $tempLight -Recurse -Force
}

if (Test-Path "hayanaqra-dist-light.zip") { Remove-Item -Force "hayanaqra-dist-light.zip" }
Compress-Archive -Path "$tempLight\*" -DestinationPath "hayanaqra-dist-light.zip" -Force
Remove-Item -Recurse -Force $tempLight

Write-Host "Creating full dist (with audio)..."
if (Test-Path "hayanaqra-dist.zip") { Remove-Item -Force "hayanaqra-dist.zip" }
Compress-Archive -Path "dist\*" -DestinationPath "hayanaqra-dist.zip" -Force

Write-Host "Done! File sizes:"
Get-Item "hayanaqra-dist-light.zip", "hayanaqra-dist.zip" | Select-Object Name, Length
