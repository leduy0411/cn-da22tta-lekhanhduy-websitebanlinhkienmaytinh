# Script để xóa console.log trong frontend và backend

$frontendPath = ".\frontend\src"
$backendPath = ".\backend"

function Remove-ConsoleLogs {
    param (
        [string]$path
    )
    
    $files = Get-ChildItem -Path $path -Filter "*.js" -Recurse
    $totalRemoved = 0
    
    foreach ($file in $files) {
        $content = Get-Content $file.FullName -Raw
        $originalLength = $content.Length
        
        # Xóa console.log và console.error (giữ lại error trong catch blocks)
        $newContent = $content -replace "^\s*console\.log\(.*?\);\s*$", "" -replace "`r`n`r`n`r`n", "`r`n`r`n"
        
        if ($newContent.Length -ne $originalLength) {
            Set-Content -Path $file.FullName -Value $newContent -NoNewline
            $totalRemoved++
            Write-Host "✅ Cleaned: $($file.Name)" -ForegroundColor Green
        }
    }
    
    return $totalRemoved
}

Write-Host "`n🧹 Cleaning console.logs from frontend..." -ForegroundColor Cyan
$frontendCleaned = Remove-ConsoleLogs -path $frontendPath

Write-Host "`n🧹 Cleaning console.logs from backend..." -ForegroundColor Cyan  
$backendCleaned = Remove-ConsoleLogs -path $backendPath

Write-Host "`n✨ Done! Cleaned $($frontendCleaned + $backendCleaned) files" -ForegroundColor Yellow
