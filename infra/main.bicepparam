using './main.bicep'

param environmentName = 'prod'

param location = 'centralus'

param containerAppEnvResourceId = ''

param postgresAdminUsername = 'pgadmin'

// Required at deploy time. Export POSTGRES_ADMIN_PASSWORD before running az deployment group create.
param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD')

param postgresDatabaseName = 'playgrid'

param customDomainUat = 'playgrid-test.kirbytoso.xyz'
param customDomainProd = 'playgrid.kirbytoso.xyz'
