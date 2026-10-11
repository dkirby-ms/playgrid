@description('Environment name used in resource names and tags')
param environmentName string = 'prod'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('PostgreSQL administrator username')
param postgresAdminUsername string = 'pgadmin'

@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

@description('PostgreSQL database name')
param postgresDatabaseName string = 'playgrid'

@description('Custom domain name (optional)')
param customDomain string = ''

// Naming convention: playgrid-{env}-{resource-type}
var resourcePrefix = 'playgrid-${environmentName}'
var containerAppEnvName = '${resourcePrefix}-cae'
var containerAppEnvId = containerAppEnv.id
var containerAppName = 'playgrid-${environmentName}'
var logAnalyticsName = '${resourcePrefix}-logs'
var postgresServerName = '${resourcePrefix}-pg'
var keyVaultName = replace('${resourcePrefix}-kv', '-', '') // shorten for 24 char limit
var customDomains = empty(customDomain)
  ? []
  : [
      {
        name: customDomain
        bindingType: 'Disabled'
      }
    ]

// PostgreSQL SKU
var postgresSkuName = 'Standard_B1ms'

// Tags for all resources
var tags = {
  environment: environmentName
  project: 'playgrid'
  managedBy: 'bicep'
}
var logAnalyticsRetentionInDays = 90

// Log Analytics Workspace for the Container Apps Environment
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: logAnalyticsRetentionInDays
  }
}

// Container App Environment
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppEnvName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
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
    tier: 'Burstable'
  }
  properties: {
    version: '15'
    administratorLogin: postgresAdminUsername
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
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
    managedEnvironmentId: containerAppEnv.id
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
      // Registry credentials and secrets are configured by the CD workflow after RBAC propagation.
      // Adding Key Vault secret refs here causes a bootstrap failure: the system-assigned identity
      // needs the Key Vault Secrets User role, which depends on the container app's principalId.
    }
    template: {
      containers: [
        {
          name: 'playgrid'
          // Placeholder until the first CD run deploys the real GHCR image.
          image: 'node:22-alpine'
          command: [
            'node'
          ]
          args: [
            'server/dist/src/index.js'
          ]
          resources: {
            cpu: json('1.0')
            memory: '2.0Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '2567'
            }
            // DISABLED_GAMES is set by deploy workflows via --set-env-vars using
            // the GitHub Actions environment variable vars.DISABLED_GAMES.
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
              initialDelaySeconds: 30
              periodSeconds: 5
              timeoutSeconds: 5
              failureThreshold: 6
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
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
output containerAppName string = containerApp.name
output containerAppEnvironmentName string = last(split(containerAppEnvId, '/'))
output containerAppEnvironmentId string = containerAppEnvId
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
output containerAppIdentityPrincipalId string = containerApp.identity.principalId
output postgresServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
output postgresDatabaseName string = postgresDatabaseName
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output logAnalyticsWorkspaceId string = logAnalytics.id
output logAnalyticsCustomerId string = logAnalytics.properties.customerId
