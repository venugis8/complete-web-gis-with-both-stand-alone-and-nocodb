import { NocoDBClient, type NocoDBConfig, type NocoDBUser, type NocoDBClientConfig } from './nocodb-client';

interface ClientDeploymentConfig {
  clientId: string;
  clientName: string;
  subdomain: string;
  backendType: 'nocodb' | 'teable' | 'standalone';
  adminEmail: string;
  backendConfig: {
    // NocoDB specific
    nocodbUrl?: string;
    nocodbApiToken?: string;
    nocodbBaseId?: string;
    
    // Teable specific
    teableUrl?: string;
    teableApiToken?: string;
    teableBaseId?: string;
    
    // Standalone specific
    postgresUrl?: string;
  };
  customizations: {
    branding: {
      logo?: string;
      primaryColor: string;
      secondaryColor: string;
      companyName: string;
    };
    features: {
      advancedMapping: boolean;
      userManagement: boolean;
      apiAccess: boolean;
      csvImport: boolean;
      activityLogs: boolean;
    };
    mapConfig: {
      defaultCenter: [number, number];
      defaultZoom: number;
      baseMaps: string[];
    };
  };
}

interface ClientInfo {
  clientId: string;
  clientName: string;
  subdomain: string;
  backendType: string;
  status: 'active' | 'inactive' | 'maintenance';
  createdAt: string;
  lastAccessed?: string;
  userCount: number;
  dataTableCount: number;
}

class ClientManager {
  private clients: Map<string, any> = new Map();

  // ============ CLIENT DEPLOYMENT ============

  async deployClient(config: ClientDeploymentConfig): Promise<ClientInfo> {
    console.log(`Deploying ${config.backendType} client: ${config.clientId}`);

    try {
      // 1. Create client folder structure
      await this.createClientFolder(config);

      // 2. Initialize backend-specific setup
      let backendClient: any;
      switch (config.backendType) {
        case 'nocodb':
          backendClient = await this.setupNocoDBClient(config);
          break;
        case 'teable':
          backendClient = await this.setupTeableClient(config);
          break;
        case 'standalone':
          backendClient = await this.setupStandaloneClient(config);
          break;
        default:
          throw new Error(`Unsupported backend type: ${config.backendType}`);
      }

      // 3. Store client reference
      this.clients.set(config.clientId, backendClient);

      // 4. Generate client-specific pages
      await this.generateClientPages(config);

      // 5. Set up routing
      await this.setupClientRouting(config);

      return {
        clientId: config.clientId,
        clientName: config.clientName,
        subdomain: config.subdomain,
        backendType: config.backendType,
        status: 'active',
        createdAt: new Date().toISOString(),
        userCount: 0,
        dataTableCount: 0
      };

    } catch (error) {
      console.error(`Failed to deploy client ${config.clientId}:`, error);
      throw error;
    }
  }

  // ============ NOCODB CLIENT SETUP ============

  private async setupNocoDBClient(config: ClientDeploymentConfig): Promise<NocoDBClient> {
    if (!config.backendConfig.nocodbUrl || !config.backendConfig.nocodbApiToken || !config.backendConfig.nocodbBaseId) {
      throw new Error('NocoDB configuration is incomplete');
    }

    const nocodbConfig: NocoDBConfig = {
      baseUrl: config.backendConfig.nocodbUrl,
      apiToken: config.backendConfig.nocodbApiToken,
      baseId: config.backendConfig.nocodbBaseId,
      clientId: config.clientId
    };

    const client = new NocoDBClient(nocodbConfig);

    // Initialize required tables
    await client.initializeClientTables();

    // Save client configuration
    await client.saveClientConfig({
      clientId: config.clientId,
      clientName: config.clientName,
      subdomain: config.subdomain,
      branding: config.customizations.branding,
      features: config.customizations.features,
      mapConfig: config.customizations.mapConfig
    });

    // Create admin user
    await client.createUser({
      email: config.adminEmail,
      name: 'Admin User',
      role: 'admin',
      password: 'admin123' // In production, generate secure password
    });

    console.log(`NocoDB client ${config.clientId} initialized successfully`);
    return client;
  }

  // ============ TEABLE CLIENT SETUP ============

  private async setupTeableClient(config: ClientDeploymentConfig): Promise<any> {
    // TODO: Implement Teable client setup
    console.log(`Setting up Teable client: ${config.clientId}`);
    throw new Error('Teable integration not yet implemented');
  }

  // ============ STANDALONE CLIENT SETUP ============

  private async setupStandaloneClient(config: ClientDeploymentConfig): Promise<any> {
    // TODO: Implement Standalone client setup
    console.log(`Setting up Standalone client: ${config.clientId}`);
    throw new Error('Standalone integration not yet implemented');
  }

  // ============ CLIENT FOLDER MANAGEMENT ============

  private async createClientFolder(config: ClientDeploymentConfig): Promise<void> {
    const clientPath = `clients/${config.backendType}/${config.clientId}`;
    
    // In a real implementation, you would create actual directories
    // For now, we'll simulate this
    console.log(`Creating client folder: ${clientPath}`);
    
    // Create folder structure:
    // clients/nocodb/client-a/
    // ├── pages/
    // │   ├── map.html
    // │   ├── dashboard.html
    // │   ├── permissions.html
    // │   └── users.html
    // ├── assets/
    // │   ├── styles.css
    // │   ├── scripts.js
    // │   └── logo.png
    // ├── config/
    // │   ├── client-config.json
    // │   └── features.json
    // └── templates/
    //     └── email-templates/
  }

  private async generateClientPages(config: ClientDeploymentConfig): Promise<void> {
    console.log(`Generating pages for client: ${config.clientId}`);
    
    // Generate customized HTML pages based on the existing React components
    // This would involve server-side rendering or static generation
    
    const pages = [
      'map.html',
      'dashboard.html', 
      'permissions.html',
      'users.html',
      'settings.html'
    ];

    for (const page of pages) {
      await this.generatePage(config, page);
    }
  }

  private async generatePage(config: ClientDeploymentConfig, pageName: string): Promise<void> {
    // Generate HTML page with client-specific customizations
    console.log(`Generating ${pageName} for ${config.clientId}`);
    
    // This would use the existing React components and render them to HTML
    // with client-specific configurations applied
  }

  private async setupClientRouting(config: ClientDeploymentConfig): Promise<void> {
    console.log(`Setting up routing for client: ${config.clientId}`);
    
    // Set up routes like:
    // /clients/nocodb/client-a/map
    // /clients/nocodb/client-a/dashboard
    // /clients/nocodb/client-a/permissions
  }

  // ============ CLIENT MANAGEMENT ============

  async getClient(clientId: string): Promise<any> {
    return this.clients.get(clientId);
  }

  async getAllClients(): Promise<ClientInfo[]> {
    // In a real implementation, this would fetch from a master database
    // For now, return mock data
    return [
      {
        clientId: 'acme-corp',
        clientName: 'ACME Corporation',
        subdomain: 'acme',
        backendType: 'nocodb',
        status: 'active',
        createdAt: '2024-01-15T10:00:00Z',
        lastAccessed: '2024-01-20T15:30:00Z',
        userCount: 25,
        dataTableCount: 8
      },
      {
        clientId: 'tech-startup',
        clientName: 'Tech Startup Inc',
        subdomain: 'techstartup',
        backendType: 'teable',
        status: 'active',
        createdAt: '2024-01-18T14:00:00Z',
        lastAccessed: '2024-01-20T09:15:00Z',
        userCount: 12,
        dataTableCount: 5
      }
    ];
  }

  async updateClient(clientId: string, updates: Partial<ClientDeploymentConfig>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    // Update client configuration
    console.log(`Updating client ${clientId}:`, updates);
    
    // Apply updates to the backend
    if (updates.customizations) {
      await client.saveClientConfig(updates.customizations);
    }
  }

  async deleteClient(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    // Clean up client data and files
    console.log(`Deleting client: ${clientId}`);
    this.clients.delete(clientId);
    
    // In a real implementation, you would:
    // 1. Delete client folder
    // 2. Clean up backend data
    // 3. Remove routing
  }

  // ============ CLIENT STATISTICS ============

  async getClientStats(clientId: string): Promise<{
    userCount: number;
    tableCount: number;
    recordCount: number;
    lastActivity: string;
  }> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    // Get statistics from the backend
    const users = await client.getUsers();
    const tables = await client.getTables();
    
    // Calculate total records across all tables
    let totalRecords = 0;
    for (const table of tables) {
      const records = await client.getRecords(table.id, { limit: 1 });
      totalRecords += records.pageInfo?.totalRows || 0;
    }

    const activityLogs = await client.getActivityLogs({ limit: 1 });
    const lastActivity = activityLogs.length > 0 ? activityLogs[0].timestamp : 'Never';

    return {
      userCount: users.length,
      tableCount: tables.length,
      recordCount: totalRecords,
      lastActivity
    };
  }
}

export { ClientManager, type ClientDeploymentConfig, type ClientInfo };