import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import NocoDBClientManager from '@/components/nocodb-client-manager';
import { ClientManager, type ClientInfo } from '@/lib/client-manager';
import { 
  Database, 
  Users, 
  Activity, 
  Settings, 
  Plus,
  TrendingUp,
  Server,
  Cloud,
  HardDrive
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const [showNocoDBManager, setShowNocoDBManager] = useState(false);
  const clientManager = new ClientManager();

  // Fetch all clients for dashboard overview
  const { data: clients, isLoading: clientsLoading } = useQuery<ClientInfo[]>({
    queryKey: ['clients'],
    queryFn: () => clientManager.getAllClients()
  });

  // Calculate dashboard statistics
  const dashboardStats = {
    totalClients: clients?.length || 0,
    activeClients: clients?.filter(c => c.status === 'active').length || 0,
    totalUsers: clients?.reduce((sum, client) => sum + client.userCount, 0) || 0,
    totalTables: clients?.reduce((sum, client) => sum + client.dataTableCount, 0) || 0,
    nocodbClients: clients?.filter(c => c.backendType === 'nocodb').length || 0,
    teableClients: clients?.filter(c => c.backendType === 'teable').length || 0,
    standaloneClients: clients?.filter(c => c.backendType === 'standalone').length || 0
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
      case 'maintenance':
        return <Badge className="bg-yellow-100 text-yellow-800">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getBackendIcon = (backendType: string) => {
    switch (backendType) {
      case 'nocodb':
        return <Database className="h-4 w-4 text-purple-500" />;
      case 'teable':
        return <Cloud className="h-4 w-4 text-blue-500" />;
      case 'standalone':
        return <Server className="h-4 w-4 text-green-500" />;
      default:
        return <HardDrive className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
            <p className="text-gray-600">Manage all client deployments and system configurations</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              onClick={() => setShowNocoDBManager(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Database className="h-4 w-4 mr-2" />
              Manage NocoDB Clients
            </Button>
            <Button variant="outline">
              <Cloud className="h-4 w-4 mr-2" />
              Manage Teable Clients
            </Button>
            <Button variant="outline">
              <Server className="h-4 w-4 mr-2" />
              Manage Standalone Clients
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Overview Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Clients</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalClients}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Database className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">{dashboardStats.activeClients} active</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalUsers}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                Across all client deployments
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Data Tables</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardStats.totalTables}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Activity className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                Total data tables managed
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Backend Types</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      NocoDB: {dashboardStats.nocodbClients}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Teable: {dashboardStats.teableClients}
                    </Badge>
                  </div>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Settings className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                Standalone: {dashboardStats.standaloneClients}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Client Deployments</CardTitle>
              <Button 
                onClick={() => setShowNocoDBManager(true)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Deploy New Client
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {clientsLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : clients && clients.length > 0 ? (
              <div className="space-y-4">
                {clients.map((client) => (
                  <div key={client.clientId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-gray-100 rounded-full">
                        {getBackendIcon(client.backendType)}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{client.clientName}</h4>
                        <p className="text-sm text-gray-600">{client.subdomain}.nocobase.com</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <div className="text-sm text-gray-600">
                        <div className="flex items-center space-x-4">
                          <span>{client.userCount} users</span>
                          <span>{client.dataTableCount} tables</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Created: {new Date(client.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {getStatusBadge(client.status)}
                        <Badge variant="outline" className="capitalize">
                          {client.backendType}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.open(`/clients/${client.backendType}/${client.clientId}/map`, '_blank')}
                        >
                          Open
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Clients Deployed</h3>
                <p className="text-gray-600 mb-4">Get started by deploying your first client</p>
                <Button onClick={() => setShowNocoDBManager(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Deploy First Client
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-purple-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setShowNocoDBManager(true)}>
            <CardContent className="p-6 text-center">
              <Database className="h-12 w-12 text-purple-500 mx-auto mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">NocoDB Clients</h3>
              <p className="text-sm text-gray-600 mb-4">Deploy and manage NocoDB-powered clients</p>
              <Badge className="bg-purple-100 text-purple-800">{dashboardStats.nocodbClients} deployed</Badge>
            </CardContent>
          </Card>

          <Card className="border-blue-200 hover:shadow-md transition-shadow cursor-pointer opacity-60">
            <CardContent className="p-6 text-center">
              <Cloud className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">Teable Clients</h3>
              <p className="text-sm text-gray-600 mb-4">Deploy and manage Teable.io-powered clients</p>
              <Badge variant="outline">Coming Soon</Badge>
            </CardContent>
          </Card>

          <Card className="border-green-200 hover:shadow-md transition-shadow cursor-pointer opacity-60">
            <CardContent className="p-6 text-center">
              <Server className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">Standalone Clients</h3>
              <p className="text-sm text-gray-600 mb-4">Deploy and manage standalone PostgreSQL clients</p>
              <Badge variant="outline">Coming Soon</Badge>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* NocoDB Client Manager Modal */}
      <NocoDBClientManager 
        isOpen={showNocoDBManager}
        onClose={() => setShowNocoDBManager(false)}
      />
    </div>
  );
}