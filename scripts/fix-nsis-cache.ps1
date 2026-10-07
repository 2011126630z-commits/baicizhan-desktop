# Rebuild Tauri NSIS bundler cache using GitHub mirrors with resume + retries
$ErrorActionPreference = "Continue"
$nsis = Join-Path $env:LOCALAPPDATA "tauri\NSIS"
$mirrors = @(
  "https://ghproxy.net/",
  "https://gh-proxy.com/",
  "https://ghfast.top/",
  "https://mirror.ghproxy.com/"
)
$zipUrl = "https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip"
$dllUrl = "https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.5.3/nsis_tauri_utils.dll"

New-Item -ItemType Directory -Force -Path $nsis | Out-Null

function Fetch($url, $out, $minBytes) {
  if ((Test-Path $out) -and (Get-Item $out).Length -ge $minBytes) {
    Write-Output ("cached: {0}" -f (Get-Item $out).Length); return $true
  }
  for ($round = 1; $round -le 3; $round++) {
    foreach ($m in $mirrors) {
      Write-Output "round $round mirror: $m"
      $has = Test-Path $out
      if ($has) {
        & curl.exe -fsSL -C - --connect-timeout 15 --max-time 120 -o $out ($m + $url) 2>$null | Out-Null
      } else {
        & curl.exe -fsSL --connect-timeout 15 --max-time 120 -o $out ($m + $url) 2>$null | Out-Null
      }
      if ((Test-Path $out) -and (Get-Item $out).Length -ge $minBytes) {
        Write-Output ("done: {0} bytes" -f (Get-Item $out).Length); return $true
      }
      if (Test-Path $out) {
        Write-Output ("partial: {0} bytes" -f (Get-Item $out).Length)
      }
    }
  }
  return $false
}

$zipPath = Join-Path $nsis "nsis-3.11.zip"
if (-not (Fetch $zipUrl $zipPath 2361546)) { throw "NSIS zip download failed" }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  foreach ($entry in $archive.Entries) {
    $rel = $entry.FullName -replace '^nsis-3\.11/', ''
    if ([string]::IsNullOrWhiteSpace($rel)) { continue }
    if ($rel.EndsWith('/')) { continue }
    $dest = Join-Path $nsis $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true)
  }
} finally { $archive.Dispose() }
Write-Output "extracted"

$dllPath = Join-Path $nsis "nsis_tauri_utils.dll"
if (-not (Fetch $dllUrl $dllPath 30000)) { throw "nsis_tauri_utils.dll download failed" }

foreach ($pdir in @("Plugins\x86-unicode", "Plugins\x86-ansi")) {
  $d = Join-Path $nsis $pdir
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  Copy-Item $dllPath (Join-Path $d "nsis_tauri_utils.dll") -Force
}
Write-Output "dll placed"

foreach ($f in @("makensis.exe", "Plugins\x86-unicode\nsis_tauri_utils.dll", "nsis-3.11.zip")) {
  $p = Join-Path $nsis $f
  Write-Output ("{0} -> {1}" -f $f, (Test-Path $p))
}
Write-Output "NSIS cache ready"
