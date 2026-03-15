@description('Environment name (dev, uat, prod)')
@allowed([
  'dev'
  'uat'
  'prod'
])
param environmentName string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Existing Container Apps Environment resource ID to reuse (optional)')
param containerAppEnvResourceId string = ''

@description('PostgreSQL administrator username')
param postgresAdminUsername string = 'pgadmin'

@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

@description('PostgreSQL database name')
param postgresDatabaseName string = 'playgrid'

@description('UAT custom domain name (optional)')
param customDomainUat string = ''

@description('Production custom domain name (optional)')
param customDomainProd string = ''

// Naming convention: playgrid-{env}-{resource-type}
var resourcePrefix = 'playgrid-${environmentName}'
var sharedInfrastructurePrefix = 'playgrid-shared'
var usesSharedContainerInfrastructure = environmentName == 'uat' || environmentName == 'prod'
var acrName = replace('${resourcePrefix}acr', '-', '') // ACR names cannot contain hyphens
var containerAppEnvName = usesSharedContainerInfrastructure ? '${sharedInfrastructurePrefix}-cae' : '${resourcePrefix}-cae'
var createContainerAppEnv = empty(containerAppEnvResourceId)
var containerAppEnvId = createContainerAppEnv ? resourceId('Microsoft.App/managedEnvironments', containerAppEnvName) : containerAppEnvResourceId
var containerAppName = 'playgrid-${environmentName}'
var logAnalyticsName = usesSharedContainerInfrastructure ? '${sharedInfrastructurePrefix}-logs' : '${resourcePrefix}-logs'
var postgresServerName = '${resourcePrefix}-pg'
var keyVaultName = replace('${resourcePrefix}-kv', '-', '') // shorten for 24 char limit
var selectedCustomDomain = environmentName == 'uat'
  ? customDomainUat
  : environmentName == 'prod'
    ? customDomainProd
    : ''
var customDomains = empty(selectedCustomDomain)
  ? []
  : [
      {
        name: selectedCustomDomain
        bindingType: 'Disabled'
      }
    ]
var bootstrapPlaceholderImage = 'node:22-alpine'
var bootstrapPlaceholderCommand = 'if [ -f /app/public/server/dist/src/index.js ]; then exec node /app/public/server/dist/src/index.js; fi; exec node -e "const http = require(\\"http\\"); const port = Number(process.env.PORT || 2567); http.createServer((req, res) => { if (req.url === \\"/health\\") { res.writeHead(200, { \\"Content-Type\\": \\"application/json\\" }); res.end(JSON.stringify({ status: \\"ok\\", mode: \\"bootstrap-placeholder\\" })); return; } res.writeHead(200, { \\"Content-Type\\": \\"text/plain\\" }); res.end(\\"PlayGrid infrastructure bootstrap placeholder\\"); }).listen(port, \\"0.0.0.0\\");"'

// Container App configuration based on environment
var containerAppConfig = {
  dev: {
    minReplicas: 1
    maxReplicas: 1
    cpu: '0.5'
    memory: '1.0Gi'
  }
  uat: {
    minReplicas: 1
    maxReplicas: 1
    cpu: '0.5'
    memory: '1.0Gi'
  }
  prod: {
    minReplicas: 1
    maxReplicas: 1
    cpu: '1.0'
    memory: '2.0Gi'
  }
}

// PostgreSQL SKU based on environment
var postgresSkuName = environmentName == 'prod' ? 'Standard_D2s_v3' : 'Standard_B1ms'

// Tags for all resources
var tags = {
  environment: environmentName
  project: 'playgrid'
  managedBy: 'bicep'
}
var infrastructureTags = usesSharedContainerInfrastructure
  ? {
      environment: 'shared'
      project: 'playgrid'
      managedBy: 'bicep'
      sharedBy: 'uat,prod'
    }
  : tags
var logAnalyticsRetentionInDays = usesSharedContainerInfrastructure ? 90 : 30

// Log Analytics Workspace for the Container Apps Environment
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = if (createContainerAppEnv) {
  name: logAnalyticsName
  location: location
  tags: infrastructureTags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: logAnalyticsRetentionInDays
  }
}

// Azure Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false // Use managed identity instead
    publicNetworkAccess: 'Enabled'
  }
}

// Container App Environment
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = if (createContainerAppEnv) {
  name: containerAppEnvName
  location: location
  tags: infrastructureTags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics!.properties.customerId
        sharedKey: logAnalytics!.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// PostgreSQL Flexible Server
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: postgresServerName
  location: location
  tags: tags
  sku: {
    name: postgresSkuName
    tier: environmentName == 'prod' ? 'GeneralPurpose' : 'Burstable'
  }
  properties: {
    version: '15'
    administratorLogin: postgresAdminUsername
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: environmentName == 'prod' ? 128 : 32
    }
    backup: {
      backupRetentionDays: environmentName == 'prod' ? 30 : 7
      geoRedundantBackup: environmentName == 'prod' ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// PostgreSQL Database
resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  name: postgresDatabaseName
  parent: postgresServer
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// PostgreSQL Firewall Rule - Allow Azure Services
resource postgresFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  name: 'AllowAzureServices'
  parent: postgresServer
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    publicNetworkAccess: 'Enabled'
  }
}

// Container App with managed identity
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: createContainerAppEnv ? containerAppEnv.id : containerAppEnvResourceId
    configuration: {
      ingress: {
        external: true
        targetPort: 2567
        transport: 'http'
        allowInsecure: false
        customDomains: customDomains
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: '${acr.name}.azurecr.io'
          identity: 'system'
        }
      ]
      secrets: [
        {
          name: 'postgres-connection-string'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/postgres-connection-string'
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'playgrid'
          // Use a public bootstrap image so the first infra deploy succeeds before CI has pushed the real app image into ACR.
          image: bootstrapPlaceholderImage
          command: [
            '/bin/sh'
            '-c'
          ]
          args: [
            bootstrapPlaceholderCommand
          ]
          resources: {
            cpu: json(containerAppConfig[environmentName].cpu)
            memory: containerAppConfig[environmentName].memory
          }
          env: [
            {
              name: 'NODE_ENV'
              value: environmentName == 'prod' ? 'production' : 'development'
            }
            {
              name: 'PORT'
              value: '2567'
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'postgres-connection-string'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 2567
                scheme: 'HTTP'
              }
              initialDelaySeconds: 30
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 2567
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 5
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: containerAppConfig[environmentName].minReplicas
        maxReplicas: containerAppConfig[environmentName].maxReplicas
      }
    }
  }
}

// RBAC: Container App managed identity -> ACR Pull
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, containerApp.id, 'AcrPull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// RBAC: Container App managed identity -> Key Vault Secrets User
resource keyVaultSecretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, containerApp.id, 'KeyVaultSecretsUser')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Store PostgreSQL connection string in Key Vault
resource postgresConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'postgres-connection-string'
  parent: keyVault
  properties: {
    value: 'postgresql://${postgresAdminUsername}:${postgresAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${postgresDatabaseName}?sslmode=require'
  }
}

// Outputs for GitHub Actions variables
output resourceGroupName string = resourceGroup().name
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output containerAppName string = containerApp.name
output containerAppEnvironmentName string = last(split(containerAppEnvId, '/'))
output containerAppEnvironmentId string = containerAppEnvId
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
output containerAppIdentityPrincipalId string = containerApp.identity.principalId
output postgresServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
output postgresDatabaseName string = postgresDatabaseName
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output logAnalyticsWorkspaceId string = createContainerAppEnv ? logAnalytics!.id : ''
output logAnalyticsCustomerId string = createContainerAppEnv ? logAnalytics!.properties.customerId : ''
