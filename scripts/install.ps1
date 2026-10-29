param([switch]$Rollback)

$ErrorActionPreference = 'Stop'

$project = 'D:\数据恢复程序制作项目\黑冰PC端\EX额外项目\DSH真人化'
$profile = 'D:\蓝色大肥鱼桌面端\data\profiles\desktop'
$pkgFile = Join-Path $profile 'package.json'
$backup = Join-Path $profile 'package.json.bak_20261028_humanizer'
$link = Join-Path $profile 'node_modules\dsh-humanizer'

function Remove-LinkOnly($path) {
  if (-not (Test-Path $path)) { return }
  $item = Get-Item $path -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    # 只删链接本身，不递归进目标
    [System.IO.Directory]::Delete($path, $false)
  } else {
    throw "目标不是 junction，拒绝删除：$path"
  }
}

if ($Rollback) {
  if (Test-Path $backup) {
    Copy-Item $backup $pkgFile -Force
    Write-Host "已恢复 package.json：$backup"
  } else {
    Write-Host "没有备份可恢复：$backup"
  }
  Remove-LinkOnly $link
  Write-Host '已解除 dsh-humanizer 挂载；重启 DSH 生效。'
  exit 0
}

if (-not (Test-Path $pkgFile)) { throw "profile package.json 不存在：$pkgFile" }
Copy-Item $pkgFile $backup -Force

if (-not (Test-Path $link)) {
  New-Item -ItemType Junction -Path $link -Target $project | Out-Null
  Write-Host "已创建 junction：$link -> $project"
} else {
  Write-Host "junction 已存在：$link"
}

$json = Get-Content $pkgFile -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $json.dsh) { throw 'package.json 里没有 dsh 字段，拒绝改' }
if (-not $json.dsh.profile) { throw 'package.json 里没有 dsh.profile，拒绝改' }
$bundles = @($json.dsh.profile.bundles)
if ($bundles -notcontains 'dsh-humanizer') {
  $bundles += 'dsh-humanizer'
  $json.dsh.profile.bundles = $bundles
  ($json | ConvertTo-Json -Depth 20) | Set-Content $pkgFile -Encoding UTF8
  Write-Host "已把 dsh-humanizer 加进 bundles：$($bundles -join ', ')"
} else {
  Write-Host 'bundles 里已经有 dsh-humanizer，无需重复添加'
}

Write-Host ''
Write-Host '下一步：完全退出 DSH（托盘退出）再打开，新会话右下角会出现「姆」按钮。'
Write-Host '出问题回滚：powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -Rollback'
