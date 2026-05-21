$files = Get-ChildItem -Path "app" -Include "*.ts","*.tsx" -Recurse | Where-Object { $_.FullName -notmatch "node_modules|\.next" -and $_.FullName -match '\[[^\]]+\]' }

$results = foreach ($file in $files) {
    $pathParts = $file.FullName.Split([System.IO.Path]::DirectorySeparatorChar)
    $slugs = $pathParts | Where-Object { $_ -match '^\[(.+)\]$' } | ForEach-Object { $matches[1] }
    
    if ($slugs.Count -eq 0) { continue }
    $finalSlug = $slugs[-1]
    
    # PowerShell 2.0 compatible way to get raw content
    $content = [System.IO.File]::ReadAllText($file.FullName)
    
    $paramsPropMatches = [regex]::Matches($content, 'params\.([a-zA-Z0-9_]+)')
    $detectedProps = $paramsPropMatches | ForEach-Object { $_.Groups[1].Value }
    
    $typeMatches = [regex]::Matches($content, 'params:\s*\{\s*([a-zA-Z0-9_]+)')
    $detectedTypes = $typeMatches | ForEach-Object { $_.Groups[1].Value }
    
    $allDetected = ($detectedProps + $detectedTypes) | Select-Object -Unique
    
    $isMismatch = $false
    foreach ($det in $allDetected) {
        if ($det -ne $finalSlug) {
            $isMismatch = $true
        }
    }

    if ($allDetected.Count -gt 0) {
        [PSCustomObject]@{
            File = $file.FullName
            ExpectedFinalSlug = $finalSlug
            DetectedParams = $allDetected -join ", "
            IsMismatch = $isMismatch
            SampleLines = $content.Split("`n") | Where-Object { $_ -match "params" } | Select-Object -First 3 | ForEach-Object { $_.Trim() }
        }
    }
}

$results | Format-List File, ExpectedFinalSlug, DetectedParams, IsMismatch, SampleLines
