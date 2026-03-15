using './main.bicep'

param environmentName = 'prod'

param location = 'centralus'

param containerAppEnvResourceId = ''

param postgresAdminUsername = 'pgadmin'

param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD', '')

param postgresDatabaseName = 'playgrid'

param customDomainUat = 'playgrid-test.kirbytoso.xyz'
param customDomainProd = 'playgrid.kirbytoso.xyz'
