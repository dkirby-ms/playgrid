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
// Bootstrap placeholder image/command for first-time infra deploys (before CI has pushed the real image to ACR).
// After the first CI deploy, the real image and command are used. Kept here for reference only.
// var bootstrapPlaceholderImage = 'node:22-alpine'
// var bootstrapPlaceholderCommand = 'node -e "require(\'http\').createServer((q,s)=>{s.writeHead(200,{\'Content-Type\':\'application/json\'});s.end(JSON.stringify({status:\'ok\',mode:\'placeholder\'}))}).listen(2567,\'0.0.0.0\')"'

// Container App configuration based on environment
var containerAppConfig = {
  dev: {
    minReplicas: 0
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
var postgresSkuName = 'Standard_B1ms'

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
      // Registry and secrets are configured by CI deploy workflows after RBAC propagation.
      // Adding them here causes a bootstrap failure: the system-assigned identity needs
      // AcrPull and Key Vault Secrets User roles, but those RBAC assignments depend on the
      // container app's principalId (circular dependency with propagation delay).
    }
    template: {
      containers: [
        {
          name: 'playgrid'
          // CI deploys override the image with the real ACR image. For first-time infra deploys
          // (before any CI push), manually set bootstrapPlaceholderImage param or pre-push an image.
          image: 'node:22-alpine'
          command: [
            'node'
          ]
          args: [
            'server/dist/src/index.js'
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
