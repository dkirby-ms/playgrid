using './main.bicep'

param environmentName = 'prod'

param location = 'centralus'

param containerAppEnvResourceId = ''

param postgresAdminUsername = 'pgadmin'

// Required at deploy time. Export POSTGRES_ADMIN_PASSWORD before running az deployment group create.
param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD')

param postgresDatabaseName = 'playgrid'

// Custom domains require DNS TXT records before deploy.
// 1. Deploy with these empty to create the Container App Environment.
// 2. Get the verification ID: az containerapp env show -n playgrid-shared-cae -g playgrid-rg --query "customDomainConfiguration.customDomainVerificationId" -o tsv
// 3. Create TXT record: asuid.playgrid -> {verification ID} on kirbytoso.xyz
// 4. Uncomment and re-deploy.
param customDomainUat = '' // 'playgrid-test.kirbytoso.xyz'
param customDomainProd = '' // 'playgrid.kirbytoso.xyz'
