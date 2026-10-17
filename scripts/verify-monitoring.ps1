param([string]$BaseUrl='https://dash.gympass.minifootapp.com', [switch]$RequireMetrics)
$ErrorActionPreference='Stop'
$workspace=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$ready=$false
for ($attempt=0; $attempt -lt 15; $attempt++) {
    try { $null=Invoke-WebRequest -Uri ($BaseUrl+'/login') -UseBasicParsing -TimeoutSec 5; $ready=$true; break }
    catch { Start-Sleep -Seconds 1 }
}
if (!$ready) {throw 'Dashboard did not become ready'}
foreach ($path in @('/api/monitoring','/api/whatsapp','/api/coolify/redeploy')) {
    $status=$null
    try {
        $options=@{Uri=($BaseUrl+$path);UseBasicParsing=$true;TimeoutSec=15}
        if ($path -like '*redeploy') {$options.Method='POST';$options.ContentType='application/json';$options.Body='{}'}
        $response=Invoke-WebRequest @options
        $status=[int]$response.StatusCode
    } catch { if ($_.Exception.Response) {$status=[int]$_.Exception.Response.StatusCode} else {throw} }
    if ($status -ne 401) {throw ('Anonymous route must return 401: '+$path+' returned '+$status)}
}
$row=Get-Content -LiteralPath (Join-Path $workspace 'TEST_CREDENTIALS.md') | Where-Object {$_ -match '^\| \*\*Admin'} | Select-Object -First 1
$parts=$row.Split('|')
$body=@{email=$parts[2].Trim().Trim([char]96);password=$parts[3].Trim().Trim([char]96)} | ConvertTo-Json -Compress
$login=Invoke-RestMethod -Uri 'https://api.gympass.minifootapp.com/api/v1/auth/login' -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 20
$account=if ($login.data) {$login.data} else {$login}
if (!$account.accessToken -or $account.user.role -ne 'ADMIN') {throw 'Documented test admin login failed'}
$headers=@{Authorization='Bearer '+$account.accessToken}
$monitor=Invoke-RestMethod -Uri ($BaseUrl+'/api/monitoring?hours=1') -Headers $headers -TimeoutSec 40
$relay=Invoke-RestMethod -Uri ($BaseUrl+'/api/whatsapp') -Headers $headers -TimeoutSec 40
if (!$relay.configured -or !$relay.connected -or !$relay.historyAvailable) {throw ('Relayio verification failed: '+$relay.state)}
if ($RequireMetrics -and (!$monitor.metrics -or !$monitor.metrics.collection.lastSampleAt)) {throw 'Collector metrics missing'}
[pscustomobject]@{
    AnonymousRoutes='401'; AdminRoutes='200'; Services=@($monitor.services).Count;
    CollectorPresent=($null -ne $monitor.metrics); CpuPercent=$monitor.metrics.server.cpuPercent;
    MemoryPercent=$monitor.metrics.server.memoryPercent; DiskPercent=$monitor.metrics.server.diskPercent;
    HistoryPoints=@($monitor.metrics.history).Count; Volumes=@($monitor.metrics.storage).Count;
    MeasuredApiRoutes=@($monitor.metrics.api.routes).Count; MeasuredApiRequests=$monitor.metrics.api.totalRequests;
    PartialErrors=$monitor.partialErrors; CollectionErrors=$monitor.metrics.collection.errors;
    RelayioConnected=$relay.connected; RelayioSession=$relay.channel.name; HistoryMessages=$relay.stats.total
} | ConvertTo-Json -Depth 3
