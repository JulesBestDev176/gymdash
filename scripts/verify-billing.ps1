param([string]$BaseUrl='http://localhost:3000')
$ErrorActionPreference='Stop'
try {
  $null=Invoke-WebRequest ($BaseUrl+'/api/billing/overview') -UseBasicParsing -TimeoutSec 20
  throw 'Anonymous billing access was accepted'
} catch { if (!$_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 401) {throw} }
$token=$env:GYMDASH_VERIFICATION_TOKEN
if (!$token) {throw 'Set GYMDASH_VERIFICATION_TOKEN to an existing platform super-admin access token. Gym owner test credentials are not platform credentials.'}
$headers=@{Authorization='Bearer '+$token}
$response=Invoke-WebRequest ($BaseUrl+'/api/billing/overview') -Headers $headers -UseBasicParsing -TimeoutSec 40
if ($response.Headers['Cache-Control'] -notmatch 'no-store') {throw 'Billing overview is cacheable'}
$overview=$response.Content | ConvertFrom-Json
$invoices=Invoke-RestMethod ($BaseUrl+'/api/billing/invoices?page=1') -Headers $headers -TimeoutSec 40
if ($null -eq $overview.summary -or $null -eq $overview.settings -or $null -eq $invoices.items -or $invoices.pageSize -ne 20) {throw 'Incomplete billing response'}
$invalid=$null
try {
  $null=Invoke-WebRequest ($BaseUrl+'/api/billing/invoices') -Method POST -Headers $headers -ContentType application/json -Body '{}' -UseBasicParsing -TimeoutSec 30
  throw 'Invalid invoice accepted'
} catch { if ($_.Exception.Response) {$invalid=[int]$_.Exception.Response.StatusCode} else {throw} }
if ($invalid -ne 400) {throw ('Expected invalid invoice400, got '+$invalid)}
$statuses=@($overview.gyms | Group-Object status | ForEach-Object {[pscustomobject]@{Status=$_.Name;Count=$_.Count}})
[pscustomobject]@{AnonymousAccess=401;AdminOverview=200;InvalidInvoice=$invalid;GymCount=@($overview.gyms).Count;Statuses=$statuses;Invoices=$invoices.total;MonthlyPriceConfigured=($null -ne $overview.settings.monthlyPriceFcfa);GraceDays=$overview.settings.graceDays;FinancialRecordsCreated=0} | ConvertTo-Json -Depth 4
