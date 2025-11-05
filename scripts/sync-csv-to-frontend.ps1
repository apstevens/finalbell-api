###############################################################################
# CSV Sync to Frontend Script (PowerShell)
# This script automates the process of syncing CSV data from the backend
# to the frontend marketing site (Windows version)
###############################################################################

param(
    [string]$ApiUrl = "http://localhost:8080",
    [string]$AdminApiKey = $env:ADMIN_API_KEY,
    [switch]$GitCommit = $false,
    [switch]$GitPush = $false
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = Split-Path -Parent $ScriptDir
$FrontendDir = Join-Path (Split-Path -Parent $ApiDir) "final-bell-marketing"
$CsvFile = "playwell-stock-shopify-b.csv"
$LogDir = Join-Path $ApiDir "logs"
$LogFile = Join-Path $LogDir "csv-sync.log"

# Create logs directory
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

# Function to log messages
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")

    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] $Level: $Message"

    switch ($Level) {
        "ERROR" { Write-Host $LogMessage -ForegroundColor Red }
        "WARNING" { Write-Host $LogMessage -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $LogMessage -ForegroundColor Green }
        default { Write-Host $LogMessage }
    }

    Add-Content -Path $LogFile -Value $LogMessage
}

###############################################################################
# Step 1: Trigger backend CSV sync from FTP
###############################################################################
Write-Log "Step 1: Triggering backend CSV sync..." "INFO"

if ([string]::IsNullOrEmpty($AdminApiKey)) {
    Write-Log "ADMIN_API_KEY is not set" "ERROR"
    exit 1
}

try {
    $Headers = @{
        "X-API-Key" = $AdminApiKey
    }

    $Response = Invoke-WebRequest -Uri "$ApiUrl/admin/csv/sync-cron" `
        -Method POST `
        -Headers $Headers `
        -UseBasicParsing

    if ($Response.StatusCode -eq 200) {
        Write-Log "Backend CSV sync completed successfully" "SUCCESS"
    } else {
        Write-Log "Backend CSV sync failed with status: $($Response.StatusCode)" "ERROR"
        exit 1
    }
} catch {
    Write-Log "Failed to trigger backend sync: $_" "ERROR"
    exit 1
}

###############################################################################
# Step 2: Wait for sync to complete
###############################################################################
Write-Log "Step 2: Waiting for sync to stabilize..." "INFO"
Start-Sleep -Seconds 5

###############################################################################
# Step 3: Copy CSV to frontend assets
###############################################################################
Write-Log "Step 3: Copying CSV to frontend..." "INFO"

$SourcePath = Join-Path $ApiDir "data\$CsvFile"
$DestPath = Join-Path $FrontendDir "src\assets\$CsvFile"

if (-not (Test-Path $SourcePath)) {
    Write-Log "Source CSV file not found: $SourcePath" "ERROR"
    exit 1
}

if (-not (Test-Path $FrontendDir)) {
    Write-Log "Frontend directory not found: $FrontendDir" "ERROR"
    exit 1
}

# Create assets directory if it doesn't exist
$AssetsDir = Join-Path $FrontendDir "src\assets"
if (-not (Test-Path $AssetsDir)) {
    New-Item -ItemType Directory -Path $AssetsDir | Out-Null
}

# Copy CSV file
Copy-Item -Path $SourcePath -Destination $DestPath -Force
Write-Log "CSV copied to frontend assets" "SUCCESS"

# Get file size
$FileSize = (Get-Item $DestPath).Length
$FileSizeMB = [math]::Round($FileSize / 1MB, 2)
Write-Log "File size: $FileSizeMB MB" "INFO"

###############################################################################
# Step 4: Run frontend import script
###############################################################################
Write-Log "Step 4: Running frontend product import..." "INFO"

Push-Location $FrontendDir

$ImportScript = "scripts\importProducts.mjs"
if (-not (Test-Path $ImportScript)) {
    Write-Log "Frontend import script not found: $ImportScript" "ERROR"
    Pop-Location
    exit 1
}

try {
    $Output = node $ImportScript 2>&1
    Add-Content -Path $LogFile -Value $Output
    Write-Log "Product import completed successfully" "SUCCESS"
} catch {
    Write-Log "Product import failed: $_" "ERROR"
    Pop-Location
    exit 1
}

###############################################################################
# Step 5: Build frontend (optional)
###############################################################################
Write-Log "Step 5: Building frontend..." "INFO"

try {
    $BuildOutput = npm run build 2>&1
    Add-Content -Path $LogFile -Value $BuildOutput
    Write-Log "Frontend build completed successfully" "SUCCESS"
} catch {
    Write-Log "Frontend build failed (this may be expected in development)" "WARNING"
}

###############################################################################
# Step 6: Git commit changes (optional)
###############################################################################
if ($GitCommit) {
    Write-Log "Step 6: Committing changes to git..." "INFO"

    $GitStatus = git status --porcelain "src\data\products-generated.ts" "src\assets\$CsvFile"

    if ([string]::IsNullOrEmpty($GitStatus)) {
        Write-Log "No changes to commit" "INFO"
    } else {
        git add "src\data\products-generated.ts" "src\assets\$CsvFile"
        $CommitMessage = "Auto-update: Product data from CSV sync $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        git commit -m $CommitMessage
        Write-Log "Changes committed to git" "SUCCESS"

        if ($GitPush) {
            git push
            Write-Log "Changes pushed to remote" "SUCCESS"
        }
    }
} else {
    Write-Log "Step 6: Skipping git commit" "INFO"
}

Pop-Location

###############################################################################
# Completion
###############################################################################
Write-Log "=========================================" "INFO"
Write-Log "CSV sync to frontend completed successfully!" "SUCCESS"
Write-Log "=========================================" "INFO"
Write-Log "" "INFO"
Write-Log "Summary:" "INFO"
Write-Log "  - CSV synced from FTP" "INFO"
Write-Log "  - CSV file size: $FileSizeMB MB" "INFO"
Write-Log "  - Log file: $LogFile" "INFO"
Write-Log "" "INFO"
