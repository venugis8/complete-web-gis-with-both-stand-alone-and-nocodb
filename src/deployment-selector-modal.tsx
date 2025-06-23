import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Database, Zap, Shield, Users, Cloud, Server } from "lucide-react";

type DeploymentType = 'standalone' | 'nocodb';

interface DeploymentConfig {
  type: DeploymentType;
  systemMode: 'standalone' | 'nocodb';
  features: string[];
  description: string;
  recommended: string;
}

interface DeploymentSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const deploymentConfigs: Record<DeploymentType, DeploymentConfig> = {
  standalone: {
    type: 'standalone',
    systemMode: 'standalone',
    features: [
      'Complete table management',
      'User permissions & roles',
      'CSV import/export',
      'Interactive map visualization',
      'Activity logs & audit trails',
      'Column management',
      'API access',
      'PostgreSQL database'
    ],
    description: 'Complete standalone system with all essential GIS features built-in',
    recommended: 'Most clients - simple setup, full control, easy upgrades'
  },
  nocodb: {
    type: 'nocodb',
    systemMode: 'nocodb',
    features: [
      'app.nocodb.com integration',
      'Advanced database operations',
      'Custom workflows',
      'Enterprise features',
      'External database support',
      'Advanced analytics',
      'Complex data relationships',
      'NocoDB cloud hosting'
    ],
    description: 'Powered by app.nocodb.com for maximum database flexibility',
    recommended: 'Complex database needs, existing NocoDB workflows'
  }
};

export default function DeploymentSelectorModal({ isOpen, onClose }: DeploymentSelectorModalProps) {
  const [selectedType, setSelectedType] = useState<DeploymentType>('standalone');
  const [clientName, setClientName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [description, setDescription] = useState('');
  const [nocodbConfig, setNocodbConfig] = useState({
    nocodbUrl: '',
    nocodbApiKey: '',
    nocodbBaseId: '',
    sitesTableId: '',
    nocodbAdminEmail: '',
    nocodbAdminPassword: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createBaseMutation = useMutation({
    mutationFn: async () => {
      const config = deploymentConfigs[selectedType];
      
      const payload = {
        name: clientName,
        subdomain,
        adminEmail,
        adminPassword: selectedType === 'standalone' ? adminPassword : undefined,
        description,
        systemMode: config.systemMode,
        deploymentType: selectedType,
        ...(config.systemMode === 'nocodb' ? nocodbConfig : {})
      };
      
      return apiRequest("POST", "/api/super-admin/bases", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/bases"] });
      onClose();
      toast({
        title: "Deployment Successful",
        description: `${selectedType} deployment created for ${clientName}`,
      });
      setClientName('');
      setSubdomain('');
      setAdminEmail('');
      setAdminPassword('');
      setDescription('');
      setNocodbConfig({ 
        nocodbUrl: '', 
        nocodbApiKey: '', 
        nocodbBaseId: '', 
        sitesTableId: '', 
        nocodbAdminEmail: '', 
        nocodbAdminPassword: '' 
      });
    },
    onError: (error) => {
      toast({
        title: "Deployment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getDeploymentIcon = (type: DeploymentType) => {
    switch (type) {
      case 'standalone':
        return <Server className="h-8 w-8 text-blue-500" />;
      case 'nocodb':
        return <Cloud className="h-8 w-8 text-purple-500" />;
      default:
        return <Database className="h-8 w-8 text-gray-500" />;
    }
  };

  const handleDeploy = () => {
    if (!clientName || !subdomain || !adminEmail) {
      toast({
        title: "Missing Information",
        description: "Please fill in client name, subdomain, and admin email",
        variant: "destructive",
      });
      return;
    }

    if (selectedType === 'nocodb' && (!nocodbConfig.nocodbUrl || !nocodbConfig.nocodbApiKey)) {
      toast({
        title: "Missing NocoDB Configuration",
        description: "Please provide NocoDB URL and API key",
        variant: "destructive",
      });
      return;
    }

    createBaseMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Zap className="h-6 w-6 text-green-500" />
            <span>Deploy New System</span>
          </DialogTitle>
          <DialogDescription>
            Choose the deployment type that best fits your client's needs
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Deployment Type Selection */}
          <div>
            <Label className="text-base font-medium mb-4 block">Choose Deployment Type</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(deploymentConfigs).map(([type, config]) => (
                <Card 
                  key={type}
                  className={`cursor-pointer transition-all ${
                    selectedType === type 
                      ? 'border-primary ring-2 ring-primary/20' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedType(type as DeploymentType)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getDeploymentIcon(type as DeploymentType)}
                        <div>
                          <CardTitle className="capitalize text-lg">{type}</CardTitle>
                          <CardDescription className="text-sm">
                            {config.systemMode === 'standalone' ? 'PostgreSQL + Self-hosted' : 'app.nocodb.com'}
                          </CardDescription>
                        </div>
                      </div>
                      {selectedType === type && (
                        <CheckCircle className="h-6 w-6 text-primary" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-gray-600 mb-3">{config.description}</p>
                    <div className="space-y-2 mb-4">
                      <Label className="text-xs font-medium text-gray-500">FEATURES</Label>
                      <div className="flex flex-wrap gap-1">
                        {config.features.slice(0, 4).map((feature, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {config.features.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{config.features.length - 4} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="border-t pt-3">
                      <Label className="text-xs font-medium text-gray-500">RECOMMENDED FOR</Label>
                      <p className="text-xs text-gray-600 mt-1">{config.recommended}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Client Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientName">Client Name *</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client name"
              />
            </div>
            <div>
              <Label htmlFor="subdomain">Subdomain *</Label>
              <Input
                id="subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="client-subdomain"
              />
            </div>
          </div>
          
          {/* Client Admin Email */}
          <div>
            <Label htmlFor="adminEmail">Client Admin Email *</Label>
            <Input
              id="adminEmail"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@client-company.com"
            />
            <p className="text-sm text-gray-500 mt-1">
              {selectedType === 'standalone' 
                ? 'Login credentials for client admin access'
                : 'Magic link for initial setup will be sent to this email'
              }
            </p>
          </div>

          {/* Admin Password (only for standalone) */}
          {selectedType === 'standalone' && (
            <div>
              <Label htmlFor="adminPassword">Client Admin Password *</Label>
              <Input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter secure password"
              />
              <p className="text-sm text-gray-500 mt-1">
                This password will be provided to the client admin for login
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the deployment"
              rows={3}
            />
          </div>

          {/* NocoDB Configuration (shown only for NocoDB deployment) */}
          {selectedType === 'nocodb' && (
            <div className="border rounded-lg p-4 bg-purple-50">
              <Label className="text-base font-medium mb-4 block">
                <Cloud className="h-4 w-4 inline mr-2" />
                NocoDB Configuration
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nocodbUrl">NocoDB URL *</Label>
                  <Input
                    id="nocodbUrl"
                    value={nocodbConfig.nocodbUrl}
                    onChange={(e) => setNocodbConfig(prev => ({ ...prev, nocodbUrl: e.target.value }))}
                    placeholder="https://app.nocodb.com"
                  />
                </div>
                <div>
                  <Label htmlFor="nocodbApiKey">API Key *</Label>
                  <Input
                    id="nocodbApiKey"
                    type="password"
                    value={nocodbConfig.nocodbApiKey}
                    onChange={(e) => setNocodbConfig(prev => ({ ...prev, nocodbApiKey: e.target.value }))}
                    placeholder="Your NocoDB API key"
                  />
                </div>
                <div>
                  <Label htmlFor="nocodbBaseId">Base ID</Label>
                  <Input
                    id="nocodbBaseId"
                    value={nocodbConfig.nocodbBaseId}
                    onChange={(e) => setNocodbConfig(prev => ({ ...prev, nocodbBaseId: e.target.value }))}
                    placeholder="NocoDB base ID"
                  />
                </div>
                <div>
                  <Label htmlFor="sitesTableId">Sites Table ID</Label>
                  <Input
                    id="sitesTableId"
                    value={nocodbConfig.sitesTableId}
                    onChange={(e) => setNocodbConfig(prev => ({ ...prev, sitesTableId: e.target.value }))}
                    placeholder="Sites table ID"
                  />
                </div>
                <div>
                  <Label htmlFor="nocodbAdminEmail">NocoDB Admin Email *</Label>
                  <Input
                    id="nocodbAdminEmail"
                    type="email"
                    value={nocodbConfig.nocodbAdminEmail}
                    onChange={(e) => setNocodbConfig(prev => ({ ...prev, nocodbAdminEmail: e.target.value }))}
                    placeholder="admin@nocodb-account.com"
                  />
                </div>
                <div>
                  <Label htmlFor="nocodbAdminPassword">NocoDB Admin Password *</Label>
                  <Input
                    id="nocodbAdminPassword"
                    type="password"
                    value={nocodbConfig.nocodbAdminPassword}
                    onChange={(e) => setNocodbConfig(prev => ({ ...prev, nocodbAdminPassword: e.target.value }))}
                    placeholder="Your NocoDB password"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Deploy Button */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeploy}
              disabled={createBaseMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createBaseMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deploying...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Deploy System
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}