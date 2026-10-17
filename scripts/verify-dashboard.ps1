param([string]$BaseUrl='http://localhost:3000')
$ErrorActionPreference='Stop'
$workspace=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
try {
  $response=Invoke-WebRequest ($BaseUrl+'/api/dashboard/analytics?period=30d') -UseBasicParsing -TimeoutSec 20
  throw 'Anonymous analytics access was accepted'
} catch {
  if (!$_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 401) { throw }
}
$row=Get-Content -LiteralPath (Join-Path $workspace 'TEST_CREDENTIALS.md') | Where-Object {$_ -match '^\| \*\*Admin'} | Select-Object -First 1
$parts=$row.Split('|')
$body=@{email=$parts[2].Trim().Trim([char]96);password=$parts[3].Trim().Trim([char]96)} | ConvertTo-Json -Compress
$login=Invoke-RestMethod 'https://api.gympass.minifootapp.com/api/v1/auth/login' -Method POST -ContentType application/json -Body $body -TimeoutSec 20
$account=if ($login.data) {$login.data} else {$login}
if (!$account.accessToken -or $account.user.role -ne 'ADMIN') {throw 'Documented test admin login failed'}
$headers=@{Authorization='Bearer '+$account.accessToken}
$results=foreach ($period in @('30d','90d','6m')) {
  $data=Invoke-RestMethod ($BaseUrl+'/api/dashboard/analytics?period='+$period) -Headers $headers -TimeoutSec 45
  if ($data.period -ne $period) {throw 'Incorrect analytics period'}
  foreach ($field in @('revenue','newMembers','entries')) {
    $sum=($data.series | Measure-Object -Property $field -Sum).Sum
    if ($sum -ne $data.totals.$field) {throw ('Series total mismatch: '+$field)}
    $gymSum=($data.gyms | Measure-Object -Property $field -Sum).Sum
    if ($gymSum -ne $data.totals.$field) {throw ('Gym total mismatch: '+$field)}
  }
  if (($data.paymentModes | Measure-Object amount -Sum).Sum -ne $data.totals.revenue) {throw 'Payment amount total mismatch'}
  if (($data.paymentModes | Measure-Object count -Sum).Sum -ne $data.totals.payments) {throw 'Payment count total mismatch'}
  if (($data.subscriptions | Measure-Object count -Sum).Sum -ne $data.totals.members) {throw 'Current member status total mismatch'}
  [pscustomobject]@{Period=$period;Status=200;Buckets=@($data.series).Count;Revenue=$data.totals.revenue;NewMembers=$data.totals.newMembers;Entries=$data.totals.entries;Gyms=@($data.gyms).Count;TotalsConsistent=$true}
}
$results | ConvertTo-Json
