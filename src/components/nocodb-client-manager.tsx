import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ClientManager, type ClientDeploymentConfig, type ClientInfo } from '@/lib/client-manager';
import { Plus, Settings, Users, Database, Activity, ExternalLink } from 'lucide-react';

interface NocoDBClientManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NocoDBClientManager({ isOpen, onClose }: NocoDBClientManagerProps) {
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(null);
  const [deployConfig, setDeployConfig] = useState<Partial<ClientDeploymentConfig>>({
    backendType: 'nocodb',
    customizations: {
      branding: {
        primaryColor: '#3B82F6',
        secondaryColor: '#64748B',
        companyName: ''
      },
      features: {
        advancedMapping: true,
        userManagement: true,
        apiAccess: false,
        csvImport: true,
        activityLogs: true
      },
      mapConfig: {
        defaultCenter: [12.97, 77.59], // Bangalore
        defaultZoom: 10,
        baseMaps: ['osm', 'google-satellite']
      }
    }
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clientManager = new ClientManager();

  // Fetch all clients
  const { data: clients, isLoading: clientsLoading } = useQuery<ClientInfo[]>({
    queryKey: ['clients'],
    queryFn: () => clientManager.getAllClients(),
    enabled: isOpen
  });

  // Deploy new client mutation
  const deployClientMutation = useMutation({
    mutationFn: (config: ClientDeploymentConfig) => clientManager.deployClient(config),
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setShowDeployForm(false);
      resetDeployForm();
      toast({
        title: 'Client Deployed Successfully',
        description: `${newClient.clientName} has been deployed and is ready to use.`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Deployment Failed',
        description: error.message || 'Failed to deploy client. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Get client statistics
  const { data: clientStats } = useQuery({
    queryKey: ['client-stats', selectedClient?.clientId],
    queryFn: () => selectedClient ? clientManager.getClientStats(selectedClient.clientId) : null,
    enabled: !!selectedClient
  });

  const resetDeployForm = () => {
    setDeployConfig({
      backendType: 'nocodb',
      customizations: {
        branding: {
          primaryColor: '#3B82F6',
          secondaryColor: '#64748B',
          companyName: ''
        },
        features: {
          advancedMapping: true,
          userManagement: true,
          apiAccess: false,
          csvImport: true,
          activityLogs: true
        },
        mapConfig: {
          defaultCenter: [12.97, 77.59],
          defaultZoom: 10,
          baseMaps: ['osm', 'google-satellite']
        }
      }
    });
  };

  const handleDeploy = () => {
    if (!deployConfig.clientId || !deployConfig.clientName || !deployConfig.subdomain || !deployConfig.adminEmail) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    if (!deployConfig.backendConfig?.nocodbUrl || !deployConfig.backendConfig?.nocodbApiToken || !deployConfig.backendConfig?.nocodbBaseId) {
      toast({
        title: 'Missing NocoDB Configuration',
        description: 'Please provide NocoDB URL, API token, and Base ID.',
        variant: 'destructive'
      });
      return;
    }

    deployClientMutation.mutate(deployConfig as ClientDeploymentConfig);
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
        return <Database className="h-4 w-4 text-blue-500" />;
      case 'standalone':
        return <Database className="h-4 w-4 text-green-500" />;
      default:
        return <Database className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center space-x-2">
            <Database className="h-6 w-6 text-purple-500" />
            <span>NocoDB Client Manager</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Header Actions */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-medium">Deployed Clients</h3>
              <Badge variant="outline">{clients?.length || 0} clients</Badge>
            </div>
            <Button onClick={() => setShowDeployForm(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Deploy New Client
            </Button>
          </div>

          {/* Clients Grid */}
          {clientsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4 mb-4" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients?.map((client) => (
                <Card key={client.clientId} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getBackendIcon(client.backendType)}
                        <CardTitle className="text-base">{client.clientName}</CardTitle>
                      </div>
                      {getStatusBadge(client.status)}
                    </div>
                    <p className="text-sm text-gray-600">{client.subdomain}.nocobase.com</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span>{client.userCount} users</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Database className="h-4 w-4 text-gray-400" />
                          <span>{client.dataTableCount} tables</span>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        Created: {new Date(client.createdAt).toLocaleDateString()}
                        {client.lastAccessed && (
                          <div>Last accessed: {new Date(client.lastAccessed).toLocaleDateString()}</div>
                        )}
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => setSelectedClient(client)}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Manage
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => window.open(`/clients/${client.backendType}/${client.clientId}/map`, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Deploy New Client Form */}
          {showDeployForm && (
            <Card className="border-purple-200">
              <CardHeader>
                <CardTitle className="text-purple-700">Deploy New NocoDB Client</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="clientId">Client ID *</Label>
                    <Input
                      id="clientId"
                      value={deployConfig.clientId || ''}
                      onChange={(e) => setDeployConfig(prev => ({ ...prev, clientId: e.target.value }))}
                      placeholder="acme-corp"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientName">Client Name *</Label>
                    <Input
                      id="clientName"
                      value={deployConfig.clientName || ''}
                      onChange={(e) => setDeployConfig(prev => ({ ...prev, clientName: e.target.value }))}
                      placeholder="ACME Corporation"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subdomain">Subdomain *</Label>
                    <Input
                      id="subdomain"
                      value={deployConfig.subdomain || ''}
                      onChange={(e) => setDeployConfig(prev => ({ ...prev, subdomain: e.target.value }))}
                      placeholder="acme"
                    />
                  </div>
                  <div>
                    <Label htmlFor="adminEmail">Admin Email *</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={deployConfig.adminEmail || ''}
                      onChange={(e) => setDeployConfig(prev => ({ ...prev, adminEmail: e.target.value }))}
                      placeholder="admin@acme-corp.com"
                    />
                  </div>
                </div>

                {/* NocoDB Configuration */}
                <div className="border rounded-lg p-4 bg-purple-50">
                  <h4 className="font-medium mb-4 text-purple-700">NocoDB Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="nocodbUrl">NocoDB URL *</Label>
                      <Input
                        id="nocodbUrl"
                        value={deployConfig.backendConfig?.nocodbUrl || ''}
                        onChange={(e) => setDeployConfig(prev => ({
                          ...prev,
                          backendConfig: { ...prev.backendConfig, nocodbUrl: e.target.value }
                        }))}
                        placeholder="https://app.nocodb.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nocodbApiToken">API Token *</Label>
                      <Input
                        id="nocodbApiToken"
                        type="password"
                        value={deployConfig.backendConfig?.nocodbApiToken || ''}
                        onChange={(e) => setDeployConfig(prev => ({
                          ...prev,
                          backendConfig: { ...prev.backendConfig, nocodbApiToken: e.target.value }
                        }))}
                        placeholder="Your NocoDB API token"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nocodbBaseId">Base ID *</Label>
                      <Input
                        id="nocodbBaseId"
                        value={deployConfig.backendConfig?.nocodbBaseId || ''}
                        onChange={(e) => setDeployConfig(prev => ({
                          ...prev,
                          backendConfig: { ...prev.backendConfig, nocodbBaseId: e.target.value }
                        }))}
                        placeholder="NocoDB base identifier"
                      />
                    </div>
                  </div>
                </div>

                {/* Branding */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-4">Branding & Customization</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={deployConfig.customizations?.branding?.companyName || ''}
                        onChange={(e) => setDeployConfig(prev => ({
                          ...prev,
                          customizations: {
                            ...prev.customizations!,
                            branding: { ...prev.customizations!.branding, companyName: e.target.value }
                          }
                        }))}
                        placeholder="ACME Corporation"
                      />
                    </div>
                    <div>
                      <Label htmlFor="primaryColor">Primary Color</Label>
                      <Input
                        id="primaryColor"
                        type="color"
                        value={deployConfig.customizations?.branding?.primaryColor || '#3B82F6'}
                        onChange={(e) => setDeployConfig(prev => ({
                          ...prev,
                          customizations: {
                            ...prev.customizations!,
                            branding: { ...prev.customizations!.branding, primaryColor: e.target.value }
                          }
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="secondaryColor">Secondary Color</Label>
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={deployConfig.customizations?.branding?.secondaryColor || '#64748B'}
                        onChange={(e) => setDeployConfig(prev => ({
                          ...prev,
                          customizations: {
                            ...prev.customizations!,
                            branding: { ...prev.customizations!.branding, secondaryColor: e.target.value }
                          }
                        }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-4">Features</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(deployConfig.customizations?.features || {}).map(([feature, enabled]) => (
                      <label key={feature} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setDeployConfig(prev => ({
                            ...prev,
                            customizations: {
                              ...prev.customizations!,
                              features: { ...prev.customizations!.features, [feature]: e.target.checked }
                            }
                          }))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm capitalize">{feature.replace(/([A-Z])/g, ' $1').trim()}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowDeployForm(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleDeploy}
                    disabled={deployClientMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {deployClientMutation.isPending ? 'Deploying...' : 'Deploy Client'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Client Details Modal */}
          {selectedClient && (
            <Card className="border-blue-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    {getBackendIcon(selectedClient.backendType)}
                    <span>{selectedClient.clientName} Details</span>
                  </CardTitle>
                  <Button variant="outline" onClick={() => setSelectedClient(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {clientStats ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-700">{clientStats.userCount}</div>
                      <div className="text-sm text-blue-600">Users</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <Database className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-700">{clientStats.tableCount}</div>
                      <div className="text-sm text-green-600">Tables</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <Activity className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-purple-700">{clientStats.recordCount}</div>
                      <div className="text-sm text-purple-600">Records</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <Activity className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                      <div className="text-sm font-bold text-yellow-700">Last Activity</div>
                      <div className="text-xs text-yellow-600">
                        {clientStats.lastActivity !== 'Never' 
                          ? new Date(clientStats.lastActivity).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}