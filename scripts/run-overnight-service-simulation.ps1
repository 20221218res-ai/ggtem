$ErrorActionPreference = "Continue"

$BaseUrl = if ($env:GGITEM_BASE_URL) { $env:GGITEM_BASE_URL } else { "http://localhost:3000" }
$Cycles = 3
$RunBuildDuringSimulation = $env:GGITEM_RUN_BUILD_DURING_SIMULATION -eq "1"
if ($env:GGITEM_OVERNIGHT_CYCLES) {
  $parsedCycles = 0
  if ([int]::TryParse($env:GGITEM_OVERNIGHT_CYCLES, [ref]$parsedCycles) -and $parsedCycles -gt 0) {
    $Cycles = $parsedCycles
  }
}

$StartedAt = Get-Date
$Stamp = $StartedAt.ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ss-fffZ")
$ResultDir = Join-Path (Get-Location) "test-results\overnight-service-simulation-$Stamp"
New-Item -ItemType Directory -Force -Path $ResultDir | Out-Null

$Results = New-Object System.Collections.Generic.List[object]

function Write-TextFile {
  param(
    [string]$Name,
    [string]$Text
  )
  $Path = Join-Path $ResultDir $Name
  $Text | Out-File -FilePath $Path -Encoding utf8 -Append
}

function Save-Reports {
  $Passed = @($Results | Where-Object { $_.status -eq "PASSED" })
  $Failed = @($Results | Where-Object { $_.status -eq "FAILED" })
  $Summary = [ordered]@{
    startedAt = $StartedAt.ToUniversalTime().ToString("o")
    updatedAt = (Get-Date).ToUniversalTime().ToString("o")
    baseUrl = $BaseUrl
    cycles = $Cycles
    total = $Results.Count
    passed = $Passed.Count
    failed = $Failed.Count
    results = $Results
  }

  $Summary | ConvertTo-Json -Depth 8 | Out-File -FilePath (Join-Path $ResultDir "summary.json") -Encoding utf8

  $Lines = New-Object System.Collections.Generic.List[string]
  $Lines.Add("# GGtem overnight service simulation")
  $Lines.Add("")
  $Lines.Add("- started: $($Summary.startedAt)")
  $Lines.Add("- updated: $($Summary.updatedAt)")
  $Lines.Add("- baseUrl: $BaseUrl")
  $Lines.Add("- total: $($Summary.total)")
  $Lines.Add("- passed: $($Summary.passed)")
  $Lines.Add("- failed: $($Summary.failed)")
  $Lines.Add("")
  $Lines.Add("## 1. Passed scenarios")
  if ($Passed.Count -eq 0) {
    $Lines.Add("- none")
  } else {
    foreach ($Item in $Passed) {
      $Lines.Add("- [$($Item.status)] $($Item.scenario) / $($Item.id) / cycle $($Item.cycle) / $($Item.durationMs)ms / $($Item.logFile)")
    }
  }
  $Lines.Add("")
  $Lines.Add("## 2. Failed scenarios")
  if ($Failed.Count -eq 0) {
    $Lines.Add("- none")
  } else {
    foreach ($Item in $Failed) {
      $Lines.Add("- [$($Item.status)] $($Item.scenario) / $($Item.id) / cycle $($Item.cycle) / risk $($Item.risk) / $($Item.logFile)")
    }
  }
  $Lines.Add("")
  $Lines.Add("## 3. Bugs found")
  if ($Failed.Count -eq 0) {
    $Lines.Add("No failed scenarios recorded yet.")
  } else {
    $Lines.Add("Analyze each failed logFile. The runner intentionally continued after failure.")
  }
  $Lines.Add("")
  $Lines.Add("## 4. Reproduction")
  if ($Failed.Count -eq 0) {
    $Lines.Add("N/A")
  } else {
    foreach ($Item in $Failed) {
      $Lines.Add("- Re-run: $($Item.commandLine)")
    }
  }
  $Lines.Add("")
  $Lines.Add("## 5. Risk")
  if ($Failed.Count -eq 0) {
    $Lines.Add("- none")
  } else {
    foreach ($Item in $Failed) {
      $Lines.Add("- $($Item.risk): $($Item.scenario)")
    }
  }
  $Lines.Add("")
  $Lines.Add("## 6. Files to fix")
  $Lines.Add("To be determined from failed logs.")
  $Lines.Add("")
  $Lines.Add("## 7. Fix proposal")
  $Lines.Add("To be determined from failed logs.")
  $Lines.Add("")
  $Lines.Add("## 8. Tests to re-run")
  if ($Failed.Count -eq 0) {
    $Lines.Add("No failed test to re-run.")
  } else {
    foreach ($Item in $Failed) {
      $Lines.Add("- $($Item.commandLine)")
    }
  }

  $Lines -join "`n" | Out-File -FilePath (Join-Path $ResultDir "summary.md") -Encoding utf8
}

function Invoke-TestCommand {
  param(
    [string]$Id,
    [string]$Scenario,
    [string]$Risk,
    [int]$Cycle,
    [string]$CommandLine
  )

  $Phase = if ($Cycle -eq 0) { "preflight" } else { "smoke" }
  $LogFile = "{0:D2}-{1}-{2}.log" -f $Cycle, $Phase, $Id
  $LogPath = Join-Path $ResultDir $LogFile
  $Started = Get-Date

  @(
    "# $Id",
    "# scenario: $Scenario",
    "# risk: $Risk",
    "# cycle: $Cycle",
    "# command: $CommandLine",
    "# startedAt: $($Started.ToUniversalTime().ToString("o"))",
    ""
  ) | Out-File -FilePath $LogPath -Encoding utf8

  $env:GGITEM_BASE_URL = $BaseUrl
  $ExitCode = 1
  $MaxAttempts = 2
  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    if ($Attempt -gt 1) {
      @(
        "",
        "# retryAttempt: $Attempt",
        "# reason: previous attempt looked like a transient dev-server HTML/Node async failure",
        ""
      ) | Out-File -FilePath $LogPath -Encoding utf8 -Append
      Start-Sleep -Milliseconds 750
    }

    $script:LASTEXITCODE = 0
    try {
      Invoke-Expression $CommandLine *>> $LogPath
      $ExitCode = $LASTEXITCODE
    } catch {
      $_ | Out-File -FilePath $LogPath -Encoding utf8 -Append
      $ExitCode = 1
    }

    if ($ExitCode -eq 0) {
      break
    }

    $LogSnapshot = Get-Content -Path $LogPath -Raw -ErrorAction SilentlyContinue
    $LooksTransient =
      ($LogSnapshot -match "<!DOCTYPE html>") -or
      ($LogSnapshot -match "UV_HANDLE_CLOSING") -or
      ($LogSnapshot -match "Unexpected token '<'") -or
      ($ExitCode -eq -1073740791)

    if (-not $LooksTransient -or $Attempt -eq $MaxAttempts) {
      break
    }
  }
  $Finished = Get-Date
  $Status = if ($ExitCode -eq 0) { "PASSED" } else { "FAILED" }

  @(
    "",
    "# finishedAt: $($Finished.ToUniversalTime().ToString("o"))",
    "# status: $Status",
    "# exitCode: $ExitCode"
  ) | Out-File -FilePath $LogPath -Encoding utf8 -Append

  $Results.Add([ordered]@{
    id = $Id
    phase = $Phase
    cycle = $Cycle
    scenario = $Scenario
    risk = $Risk
    status = $Status
    exitCode = $ExitCode
    durationMs = [int]($Finished - $Started).TotalMilliseconds
    logFile = $LogFile
    commandLine = $CommandLine
    startedAt = $Started.ToUniversalTime().ToString("o")
    finishedAt = $Finished.ToUniversalTime().ToString("o")
  })

  Save-Reports
}

@(
  "GGtem overnight service simulation",
  "startedAt: $($StartedAt.ToUniversalTime().ToString("o"))",
  "baseUrl: $BaseUrl",
  "cycles: $Cycles",
  "runBuildDuringSimulation: $RunBuildDuringSimulation",
  "",
  "This runner continues after failures and records every result."
) -join "`n" | Out-File -FilePath (Join-Path $ResultDir "README.txt") -Encoding utf8

try {
  $Response = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 30
  Write-TextFile "server-check.log" "OK $($Response.StatusCode) $BaseUrl"
} catch {
  Write-TextFile "server-check.log" "FAILED $BaseUrl $($_.Exception.Message)"
  $Results.Add([ordered]@{
    id = "server-check"
    phase = "preflight"
    cycle = 0
    scenario = "localhost server connection"
    risk = "critical"
    status = "FAILED"
    exitCode = 1
    durationMs = 0
    logFile = "server-check.log"
    commandLine = "Invoke-WebRequest $BaseUrl"
    startedAt = (Get-Date).ToUniversalTime().ToString("o")
    finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  })
  Save-Reports
  exit 1
}

$BuildPreflight = if ($RunBuildDuringSimulation) {
  @{ id = "build"; scenario = "production build"; risk = "medium"; command = "npm.cmd run build" }
} else {
  @{
    id = "runtime-workspace"
    scenario = "runtime workspace check"
    risk = "medium"
    command = "if (Test-Path '.next') { Write-Output 'next runtime workspace exists' } else { exit 1 }"
  }
}

$Preflight = @(
  @{ id = "typecheck"; scenario = "static type check"; risk = "medium"; command = "npm.cmd run typecheck" },
  @{ id = "copy-integrity"; scenario = "user-facing copy integrity"; risk = "medium"; command = "npm.cmd run test:copy-integrity" },
  @{ id = "page-health"; scenario = "market and admin page health"; risk = "high"; command = "npm.cmd run test:page-health" },
  @{ id = "notification-lifecycle"; scenario = "deposit, withdrawal, escrow, dispute, and chat notification lifecycle"; risk = "high"; command = "npm.cmd run test:notification-lifecycle" },
  $BuildPreflight
)

$SmokeTests = @(
  @{ id = "deposit-confirmation"; scenario = "deposit approval and balance credit"; risk = "high"; command = "node scripts/run-deposit-confirmation-smoke-test.js" },
  @{ id = "deposit-rejection"; scenario = "deposit rejection and duplicate rejection guard"; risk = "high"; command = "node scripts/run-deposit-rejection-smoke-test.js" },
  @{ id = "market-purchase"; scenario = "instant purchase and escrow lock"; risk = "critical"; command = "node scripts/run-market-purchase-smoke-test.js" },
  @{ id = "escrow-order-completion"; scenario = "order completion, seller settlement, platform fee"; risk = "critical"; command = "node scripts/run-escrow-order-completion-smoke-test.js" },
  @{ id = "escrow-order-cancel-refund"; scenario = "order cancellation, refund, duplicate refund guard"; risk = "critical"; command = "node scripts/run-escrow-order-cancel-refund-smoke-test.js" },
  @{ id = "dispute-resolution"; scenario = "dispute ruling, refund, seller settlement"; risk = "critical"; command = "node scripts/run-dispute-resolution-smoke-test.js" },
  @{ id = "buy-request-instant-sale"; scenario = "buy request instant sale and settlement"; risk = "critical"; command = "node scripts/run-buy-request-instant-sale-smoke-test.js" },
  @{ id = "buy-request-cancel-refund"; scenario = "buy request cancellation and locked funds release"; risk = "critical"; command = "node scripts/run-buy-request-cancel-refund-smoke-test.js" },
  @{ id = "buy-request-dispute-resolution"; scenario = "buy request dispute resolution"; risk = "critical"; command = "node scripts/run-buy-request-dispute-resolution-smoke-test.js" },
  @{ id = "buy-request-chat-notification"; scenario = "buy request chat and notification"; risk = "medium"; command = "node scripts/run-buy-request-chat-notification-smoke-test.js" },
  @{ id = "withdrawal-flow"; scenario = "withdrawal policy, fee, and lock"; risk = "critical"; command = "node scripts/run-withdrawal-flow-smoke-test.js" },
  @{ id = "withdrawal-completion"; scenario = "withdrawal completion, txid, duplicate completion guard"; risk = "critical"; command = "node scripts/run-withdrawal-completion-smoke-test.js" },
  @{ id = "create-listing-flow"; scenario = "listing creation and inventory"; risk = "high"; command = "node scripts/run-create-listing-flow-smoke-test.js" },
  @{ id = "create-listing-public-exposure"; scenario = "public listing exposure and sold-out hiding"; risk = "high"; command = "node scripts/run-create-listing-public-exposure-smoke-test.js" },
  @{ id = "create-listing-image-ux"; scenario = "listing image ux"; risk = "medium"; command = "node scripts/run-create-listing-image-ux-smoke-test.js" },
  @{ id = "listing-image-validation"; scenario = "listing image validation"; risk = "medium"; command = "node scripts/run-listing-image-validation-smoke-test.js" },
  @{ id = "listing-detail-copy"; scenario = "listing detail copy"; risk = "low"; command = "node scripts/run-listing-detail-copy-smoke-test.js" },
  @{ id = "purchase-order-route"; scenario = "route to order after purchase"; risk = "high"; command = "node scripts/run-purchase-order-route-smoke-test.js" },
  @{ id = "purchase-validation-copy"; scenario = "purchase validation copy"; risk = "medium"; command = "node scripts/run-purchase-validation-copy-smoke-test.js" },
  @{ id = "public-visibility-policy"; scenario = "public visibility policy"; risk = "high"; command = "node scripts/run-public-visibility-policy-smoke-test.js" },
  @{ id = "my-listings-filter"; scenario = "my listings filter"; risk = "medium"; command = "node scripts/run-my-listings-filter-smoke-test.js" },
  @{ id = "seller-listing-status-actions"; scenario = "seller listing status actions"; risk = "high"; command = "node scripts/run-seller-listing-status-actions-smoke-test.js" },
  @{ id = "seller-listing-edit-status-guide"; scenario = "seller listing edit status guide"; risk = "medium"; command = "node scripts/run-seller-listing-edit-status-guide-smoke-test.js" }
)

foreach ($Item in $Preflight) {
  Invoke-TestCommand -Id $Item.id -Scenario $Item.scenario -Risk $Item.risk -Cycle 0 -CommandLine $Item.command
}

for ($Cycle = 1; $Cycle -le $Cycles; $Cycle++) {
  $Tests = $SmokeTests
  if ($Cycle % 2 -eq 0) {
    $Tests = @($SmokeTests)
    [array]::Reverse($Tests)
  }

  foreach ($Item in $Tests) {
    Invoke-TestCommand -Id $Item.id -Scenario $Item.scenario -Risk $Item.risk -Cycle $Cycle -CommandLine $Item.command
  }
}

Save-Reports
