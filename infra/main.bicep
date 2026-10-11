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

// Container App
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: tags
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
      // The DATABASE_URL secret and GHCR pull credentials are configured by the CD workflow.
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

// Outputs for GitHub Actions variables
output resourceGroupName string = resourceGroup().name
output containerAppName string = containerApp.name
output containerAppEnvironmentName string = last(split(containerAppEnvId, '/'))
output containerAppEnvironmentId string = containerAppEnvId
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
output postgresServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
output postgresDatabaseName string = postgresDatabaseName
output logAnalyticsWorkspaceId string = logAnalytics.id
output logAnalyticsCustomerId string = logAnalytics.properties.customerId
