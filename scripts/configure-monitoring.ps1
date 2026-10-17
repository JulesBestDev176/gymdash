param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$dashboardPath = Join-Path $workspace 'gymdash'
$config = Get-Content -Raw -LiteralPath (Join-Path $workspace '.mcp.json') | ConvertFrom-Json
$base = $config.mcpServers.coolify.env.COOLIFY_BASE_URL.TrimEnd('/')
$headers = @{Authorization = 'Bearer ' + $config.mcpServers.coolify.env.COOLIFY_API_TOKEN}
function Api($method, $path, $payload = $null) {
    $arguments = @{Method=$method; Uri=($base + '/api/v1' + $path); Headers=$headers; TimeoutSec=30}
    if ($null -ne $payload) { $arguments.ContentType='application/json'; $arguments.Body=[Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 10 -Compress)) }
    try { Invoke-RestMethod @arguments }
    catch { throw ('Coolify request failed: ' + $method + ' ' + $path + ' (' + $_.Exception.Message + ')') }
}
function SetLocal($values) {
    $path = Join-Path $dashboardPath '.env.local'
    $lines = if (Test-Path -LiteralPath $path) { @(Get-Content -LiteralPath $path) } else { @() }
    foreach ($key in $values.Keys) {
        $lines = @($lines | Where-Object { $_ -notmatch ('^' + [regex]::Escape($key) + '=') })
        $lines += $key + '=' + ($values[$key] | ConvertTo-Json -Compress)
    }
    [IO.File]::WriteAllLines($path, $lines, [Text.UTF8Encoding]::new($false))
}
function SetEnvs($type, $uuid, $values) {
    $data = @($values.Keys | ForEach-Object { @{key=$_; value=[string]$values[$_]; is_preview=$false; is_buildtime=$false; is_runtime=$true; is_literal=$true} })
    $null = Api 'PATCH' ('/' + $type + '/' + $uuid + '/envs/bulk') @{data=$data}
}
$dashboardId='ijpluezkha433o1szxfxaqzp'
$backendId='m3tc4qsecffvu3cfqqcfsspc'
$relayId='3ektrfq0ovokbn5lyzzes898'
$databaseId='i7bypsb5mxs0id639a60wjw9'
$dashboard = Api 'GET' ('/applications/' + $dashboardId)
$relayVars = Api 'GET' ('/applications/' + $relayId + '/envs')
$relayKeyVar = $relayVars | Where-Object { $_.key -eq 'API_KEYS' -and !$_.is_preview } | Select-Object -First 1
$relayKey = if ($relayKeyVar.real_value) { $relayKeyVar.real_value } else { $relayKeyVar.value }
$relayKey = ($relayKey -split ',')[0].Trim()
if (!$relayKey) { throw 'No Relayio API key configured in Coolify' }
$sessions = @(Invoke-RestMethod -Uri 'https://relayio.minifootapp.com/v1/sessions' -Headers @{'x-api-key'=$relayKey} -TimeoutSec 20)
if ($sessions.Count -ne 1) { throw 'Select the intended Relayio session before running this configuration' }
$envPath = Join-Path $dashboardPath '.env.local'
$existingTokenLine = @(Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^MONITORING_TOKEN=' }) | Select-Object -First 1
if ($existingTokenLine) { $token = ($existingTokenLine -split '=',2)[1].Trim('"') }
else { $bytes = New-Object byte[] 32; $generator = [Security.Cryptography.RandomNumberGenerator]::Create(); $generator.GetBytes($bytes); $generator.Dispose(); $token=([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant() }
$url='http://gympass-monitoring-agent:9108'
$values = @{
    COOLIFY_BASE_URL=$base; COOLIFY_API_TOKEN=$config.mcpServers.coolify.env.COOLIFY_API_TOKEN;
    COOLIFY_SERVER_UUID=$dashboard.destination.server.uuid;
    MONITORING_URL=$url; MONITORING_TOKEN=$token;
    RELAYIO_BASE_URL='https://relayio.minifootapp.com/v1'; RELAYIO_API_KEY=$relayKey; RELAYIO_SESSION_ID=$sessions[0].id
}
if (!$Apply) { Write-Output ('Ready: ' + $values.Keys.Count + ' dashboard variables, existing Relayio session ' + $sessions[0].name + ', internal collector on network ' + $dashboard.destination.network); exit 0 }
SetLocal $values
SetEnvs 'applications' $dashboardId $values
# Instrumentation does not modify the database or notifications. Prevent the
# existing image entrypoint from applying unrelated local migrations or seeds.
SetEnvs 'applications' $backendId @{MONITORING_URL=$url; MONITORING_TOKEN=$token; SKIP_PRISMA_MIGRATIONS='true'; SKIP_PRISMA_SEED='true'}
$services = @(Api 'GET' '/services')
$service = $services | Where-Object { $_.name -eq 'gympass-monitoring' } | Select-Object -First 1
if (!$service) {
    $compose = [IO.File]::ReadAllText((Join-Path $workspace 'monitoring-agent/compose.yaml'))
    $compose = $compose.Replace('${MONITORING_IMAGE:-gympass-monitoring-agent:local}', 'electronteams/gympass-monitor:latest')
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($compose))
    $service = Api 'POST' '/services' @{
        name='gympass-monitoring'; project_uuid=$dashboard.environment.project.uuid;
        environment_uuid=$dashboard.environment.uuid; server_uuid=$dashboard.destination.server.uuid;
        destination_uuid=$dashboard.destination.uuid; docker_compose_raw=$encoded; instant_deploy=$false
    }
}
if (!$service.uuid) { throw 'Coolify did not return a monitoring service UUID' }
SetEnvs 'services' $service.uuid @{MONITORING_TOKEN=$token; RESOURCE_UUIDS=($backendId+','+$dashboardId+','+$databaseId+','+$relayId)}
$state = @{serviceUuid=$service.uuid; dashboardUuid=$dashboardId; backendUuid=$backendId; configuredAt=[DateTimeOffset]::UtcNow.ToString('o')}
$statePath=Join-Path $dashboardPath '.monitoring-deployment.json'
[IO.File]::WriteAllText($statePath, ($state | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
Write-Output ('Configured dashboard, backend and internal monitoring service ' + $service.uuid + '. No secrets printed. Redeploy to apply.')
