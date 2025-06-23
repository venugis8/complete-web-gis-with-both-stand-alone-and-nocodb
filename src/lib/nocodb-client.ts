interface NocoDBConfig {
  baseUrl: string;
  apiToken: string;
  baseId: string;
  clientId: string;
}

interface NocoDBTable {
  id: string;
  title: string;
  table_name: string;
  columns: NocoDBColumn[];
}

interface NocoDBColumn {
  id: string;
  title: string;
  column_name: string;
  uidt: string; // UI Data Type
  dt: string;   // Database Type
}

interface NocoDBRecord {
  Id: number;
  [key: string]: any;
}

interface NocoDBUser {
  Id: number;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer' | 'commentor';
  clientId: string;
  createdAt: string;
  updatedAt: string;
}

interface NocoDBPermission {
  Id: number;
  userId: number;
  tableId: string;
  fieldName: string;
  permission: 'view' | 'edit' | 'hidden';
  clientId: string;
}

interface NocoDBClientConfig {
  Id: number;
  clientId: string;
  clientName: string;
  subdomain: string;
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
}

class NocoDBClient {
  private config: NocoDBConfig;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: NocoDBConfig) {
    this.config = config;
    this.baseUrl = `${config.baseUrl}/api/v2`;
    this.headers = {
      'xc-token': config.apiToken,
      'Content-Type': 'application/json'
    };
  }

  // ============ CORE API METHODS ============

  private async request(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: data ? JSON.stringify(data) : undefined
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NocoDB API Error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('NocoDB request failed:', error);
      throw error;
    }
  }

  // ============ TABLE MANAGEMENT ============

  async getTables(): Promise<NocoDBTable[]> {
    const response = await this.request('GET', `/meta/bases/${this.config.baseId}/tables`);
    return response.list || [];
  }

  async getTable(tableId: string): Promise<NocoDBTable> {
    return await this.request('GET', `/meta/tables/${tableId}`);
  }

  async createTable(tableName: string, columns: any[]): Promise<NocoDBTable> {
    const tableData = {
      table_name: tableName,
      title: tableName,
      columns: [
        {
          column_name: 'id',
          title: 'Id',
          uidt: 'ID',
          dt: 'int',
          pk: true,
          ai: true
        },
        ...columns
      ]
    };

    return await this.request('POST', `/meta/bases/${this.config.baseId}/tables`, tableData);
  }

  // ============ RECORD MANAGEMENT ============

  async getRecords(tableId: string, options: {
    limit?: number;
    offset?: number;
    where?: string;
    sort?: string;
  } = {}): Promise<{ list: NocoDBRecord[]; pageInfo: any }> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.where) params.append('where', options.where);
    if (options.sort) params.append('sort', options.sort);

    const queryString = params.toString();
    const endpoint = `/tables/${tableId}/records${queryString ? `?${queryString}` : ''}`;
    
    return await this.request('GET', endpoint);
  }

  async createRecord(tableId: string, data: any): Promise<NocoDBRecord> {
    // Add client isolation
    const recordData = {
      ...data,
      clientId: this.config.clientId
    };

    return await this.request('POST', `/tables/${tableId}/records`, recordData);
  }

  async updateRecord(tableId: string, recordId: string, data: any): Promise<NocoDBRecord> {
    return await this.request('PATCH', `/tables/${tableId}/records/${recordId}`, data);
  }

  async deleteRecord(tableId: string, recordId: string): Promise<void> {
    await this.request('DELETE', `/tables/${tableId}/records/${recordId}`);
  }

  // ============ USER MANAGEMENT ============

  async getUsers(): Promise<NocoDBUser[]> {
    try {
      const response = await this.getRecords('users', {
        where: `(clientId,eq,${this.config.clientId})`
      });
      return response.list as NocoDBUser[];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  async createUser(userData: {
    email: string;
    name: string;
    role: string;
    password: string;
  }): Promise<NocoDBUser> {
    const userRecord = {
      email: userData.email,
      name: userData.name,
      role: userData.role,
      password: userData.password, // In production, this should be hashed
      clientId: this.config.clientId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return await this.createRecord('users', userRecord) as NocoDBUser;
  }

  async updateUser(userId: number, updates: Partial<NocoDBUser>): Promise<NocoDBUser> {
    const updateData = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    return await this.updateRecord('users', userId.toString(), updateData) as NocoDBUser;
  }

  async deleteUser(userId: number): Promise<void> {
    await this.deleteRecord('users', userId.toString());
  }

  // ============ PERMISSIONS MANAGEMENT ============

  async getPermissions(userId?: number): Promise<NocoDBPermission[]> {
    const whereClause = userId 
      ? `(clientId,eq,${this.config.clientId})~and(userId,eq,${userId})`
      : `(clientId,eq,${this.config.clientId})`;

    try {
      const response = await this.getRecords('permissions', {
        where: whereClause
      });
      return response.list as NocoDBPermission[];
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return [];
    }
  }

  async setPermission(data: {
    userId: number;
    tableId: string;
    fieldName: string;
    permission: 'view' | 'edit' | 'hidden';
  }): Promise<NocoDBPermission> {
    // Check if permission already exists
    const existing = await this.getRecords('permissions', {
      where: `(clientId,eq,${this.config.clientId})~and(userId,eq,${data.userId})~and(tableId,eq,${data.tableId})~and(fieldName,eq,${data.fieldName})`
    });

    const permissionData = {
      userId: data.userId,
      tableId: data.tableId,
      fieldName: data.fieldName,
      permission: data.permission,
      clientId: this.config.clientId
    };

    if (existing.list.length > 0) {
      // Update existing permission
      return await this.updateRecord('permissions', existing.list[0].Id.toString(), permissionData) as NocoDBPermission;
    } else {
      // Create new permission
      return await this.createRecord('permissions', permissionData) as NocoDBPermission;
    }
  }

  async deletePermission(permissionId: number): Promise<void> {
    await this.deleteRecord('permissions', permissionId.toString());
  }

  // ============ CLIENT CONFIGURATION ============

  async getClientConfig(): Promise<NocoDBClientConfig | null> {
    try {
      const response = await this.getRecords('client_configs', {
        where: `(clientId,eq,${this.config.clientId})`,
        limit: 1
      });

      if (response.list.length > 0) {
        const config = response.list[0];
        // Parse JSON fields
        return {
          ...config,
          branding: typeof config.branding === 'string' ? JSON.parse(config.branding) : config.branding,
          features: typeof config.features === 'string' ? JSON.parse(config.features) : config.features,
          mapConfig: typeof config.mapConfig === 'string' ? JSON.parse(config.mapConfig) : config.mapConfig
        } as NocoDBClientConfig;
      }

      return null;
    } catch (error) {
      console.error('Error fetching client config:', error);
      return null;
    }
  }

  async saveClientConfig(config: Partial<NocoDBClientConfig>): Promise<NocoDBClientConfig> {
    const existing = await this.getClientConfig();
    
    const configData = {
      clientId: this.config.clientId,
      clientName: config.clientName || existing?.clientName || '',
      subdomain: config.subdomain || existing?.subdomain || '',
      branding: JSON.stringify(config.branding || existing?.branding || {}),
      features: JSON.stringify(config.features || existing?.features || {}),
      mapConfig: JSON.stringify(config.mapConfig || existing?.mapConfig || {})
    };

    if (existing) {
      return await this.updateRecord('client_configs', existing.Id.toString(), configData) as NocoDBClientConfig;
    } else {
      return await this.createRecord('client_configs', configData) as NocoDBClientConfig;
    }
  }

  // ============ ACTIVITY LOGGING ============

  async logActivity(data: {
    userId: number;
    action: string;
    tableName: string;
    recordId?: string;
    details?: any;
  }): Promise<void> {
    const logData = {
      userId: data.userId,
      action: data.action,
      tableName: data.tableName,
      recordId: data.recordId || null,
      details: data.details ? JSON.stringify(data.details) : null,
      clientId: this.config.clientId,
      timestamp: new Date().toISOString()
    };

    try {
      await this.createRecord('activity_logs', logData);
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw error for logging failures
    }
  }

  async getActivityLogs(options: {
    userId?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    let whereClause = `(clientId,eq,${this.config.clientId})`;
    if (options.userId) {
      whereClause += `~and(userId,eq,${options.userId})`;
    }

    try {
      const response = await this.getRecords('activity_logs', {
        where: whereClause,
        limit: options.limit || 50,
        offset: options.offset || 0,
        sort: '-timestamp'
      });
      return response.list;
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      return [];
    }
  }

  // ============ AUTHENTICATION ============

  async authenticateUser(email: string, password: string): Promise<NocoDBUser | null> {
    try {
      const response = await this.getRecords('users', {
        where: `(clientId,eq,${this.config.clientId})~and(email,eq,${email})`,
        limit: 1
      });

      if (response.list.length > 0) {
        const user = response.list[0] as NocoDBUser;
        // In production, compare hashed passwords
        if (user.password === password) {
          return user;
        }
      }

      return null;
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  // ============ INITIALIZATION ============

  async initializeClientTables(): Promise<void> {
    const tables = await this.getTables();
    const tableNames = tables.map(t => t.table_name);

    // Create required tables if they don't exist
    const requiredTables = [
      {
        name: 'users',
        columns: [
          { column_name: 'email', title: 'Email', uidt: 'Email', dt: 'varchar' },
          { column_name: 'name', title: 'Name', uidt: 'SingleLineText', dt: 'varchar' },
          { column_name: 'role', title: 'Role', uidt: 'SingleSelect', dt: 'varchar' },
          { column_name: 'password', title: 'Password', uidt: 'SingleLineText', dt: 'varchar' },
          { column_name: 'clientId', title: 'Client ID', uidt: 'SingleLineText', dt: 'varchar' },
          { column_name: 'createdAt', title: 'Created At', uidt: 'DateTime', dt: 'datetime' },
          { column_name: 'updatedAt', title: 'Updated At', uidt: 'DateTime', dt: 'datetime' }
        ]
      },
      {
        name: 'permissions',
        columns: [
          { column_name: 'userId', title: 'User ID', uidt: 'Number', dt: 'int' },
          { column_name: 'tableId', title: 'Table ID', uidt: 'SingleLineText', dt: 'varchar' },
          { column_name: 'fieldName', title: 'Field Name', uidt: 'SingleLineText', dt: 'varchar' },
          { column_name: 'permission', title: 'Permission', uidt: 'SingleSelect', dt: 'varchar' },
          { column_name: 'clientId', title: 'Client ID', uidt: 'SingleLineText', dt: 'varchar' }
        ]
      },
      {
        name: 'client_configs',
        columns: [
          { column_name: 'clientId', title: 'Client ID', uidt: 'SingleLineText', dt: 'varchar' },
          { column_name: 'clientName', title: 'Client Name', uidt: 'SingleLineText', dt: 'varchar' },
          { column_name: 'subdomain', title: 'Subdomain', uidt: 'SingleLineText', dt: 'varchar' },
          { column_name: 'branding', title: 'Branding', uidt: 'LongText', dt: 'text' },
          { column_name: 'features', title: 'Features', uidt: 'LongText', dt: 'text' },
          { column_name: 'mapConfig', title: 'Map Config', uidt: 'LongText', dt: 'text' }
        ]
      },
      {
        name: 'activity_logs',
        columns: [
          { column_name: 'userId', title: 'User ID', uidt: 'Number', dt: 'int' },
          { column_name: 'action', title: 'Action', uidt: 'SingleLineText', dt: 'varchar' },
          { column_name: 'tableName', title: 'Table Name', uidt: 'SingleLineText', dt: 'varchar' },
          { column_name: 'recordId', title: 'Record ID', uidt: 'SingleLineText', dt: 'varchar' },
          { column_name: 'details', title: 'Details', uidt: 'LongText', dt: 'text' },
          { column_name: 'clientId', title: 'Client ID', uidt: 'SingleLineText', dt: 'varchar' },
          { column_name: 'timestamp', title: 'Timestamp', uidt: 'DateTime', dt: 'datetime' }
        ]
      }
    ];

    for (const table of requiredTables) {
      if (!tableNames.includes(table.name)) {
        console.log(`Creating table: ${table.name}`);
        await this.createTable(table.name, table.columns);
      }
    }
  }
}

export { NocoDBClient, type NocoDBConfig, type NocoDBUser, type NocoDBPermission, type NocoDBClientConfig };