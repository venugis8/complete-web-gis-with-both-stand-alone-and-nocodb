import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getSystemModeLabel, getSystemModeDescription, getSystemModeStatus, type SystemMode } from "@/lib/system-mode";

interface Base {
  id: number;
  name: string;
  subdomain: string;
  systemMode: SystemMode;
  nocodbBaseId?: string | null;
  nocodbUrl?: string | null;
  nocodbApiKey?: string | null;
  sitesTableId?: string | null;
}

interface SystemModeSwitcherProps {
  base: Base;
}

export default function SystemModeSwitcher({ base }: SystemModeSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newMode, setNewMode] = useState<SystemMode>(base.systemMode);
  const [nocodbConfig, setNocodbConfig] = useState({
    nocodbBaseId: base.nocodbBaseId || "",
    nocodbUrl: base.nocodbUrl || "",
    nocodbApiKey: base.nocodbApiKey || "",
    sitesTableId: base.sitesTableId || "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const switchModeMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        systemMode: newMode,
        ...(newMode === 'nocodb' ? nocodbConfig : {}),
      };
      
      return apiRequest({
        url: `/api/super-admin/bases/${base.id}/system-mode`,
        method: "PATCH",
        body: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/bases"] });
      setIsOpen(false);
      toast({
        title: "System Mode Updated",
        description: `Successfully switched to ${getSystemModeLabel(newMode)}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update system mode",
        variant: "destructive",
      });
    },
  });

  const status = getSystemModeStatus(base);

  const handleSave = () => {
    if (newMode === 'nocodb' && (!nocodbConfig.nocodbBaseId || !nocodbConfig.nocodbUrl || !nocodbConfig.nocodbApiKey)) {
      toast({
        title: "Configuration Required",
        description: "Please fill in all NocoDB configuration fields",
        variant: "destructive",
      });
      return;
    }
    
    switchModeMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className="flex items-center space-x-2 cursor-pointer">
          <Badge 
            variant={status.status === 'ready' ? 'default' : status.status === 'configuration_required' ? 'destructive' : 'secondary'}
          >
            {getSystemModeLabel(base.systemMode)}
          </Badge>
          <Button variant="ghost" size="sm">
            Switch Mode
          </Button>
        </div>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>System Mode Configuration</DialogTitle>
          <DialogDescription>
            Choose how this base should operate: standalone system or with NocoDB integration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Current Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{getSystemModeLabel(base.systemMode)}</p>
                  <p className="text-sm text-muted-foreground">{status.message}</p>
                </div>
                <Badge variant={status.status === 'ready' ? 'default' : 'destructive'}>
                  {status.status === 'ready' ? 'Ready' : 'Needs Configuration'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Mode Selection */}
          <div className="space-y-4">
            <Label>System Mode</Label>
            <Select value={newMode} onValueChange={(value: SystemMode) => setNewMode(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standalone">
                  <div>
                    <div className="font-medium">Standalone System</div>
                    <div className="text-sm text-muted-foreground">Built-in table and permission management</div>
                  </div>
                </SelectItem>
                <SelectItem value="nocodb">
                  <div>
                    <div className="font-medium">NocoDB Integration</div>
                    <div className="text-sm text-muted-foreground">Advanced data management with NocoDB backend</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* NocoDB Configuration (only show when NocoDB mode selected) */}
          {newMode === 'nocodb' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">NocoDB Configuration</CardTitle>
                <CardDescription>
                  Configure the connection to your NocoDB instance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>NocoDB Base ID</Label>
                  <Input
                    value={nocodbConfig.nocodbBaseId}
                    onChange={(e) => setNocodbConfig(prev => ({ ...prev, nocodbBaseId: e.target.value }))}
                    placeholder="Your NocoDB base identifier"
                  />
                </div>
                <div>
                  <Label>NocoDB URL</Label>
                  <Input
                    value={nocodbConfig.nocodbUrl}
                    onChange={(e) => setNocodbConfig(prev => ({ ...prev, nocodbUrl: e.target.value }))}
                    placeholder="https://your-nocodb.com"
                  />
                </div>
                <div>
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={nocodbConfig.nocodbApiKey}
                    onChange={(e) => setNocodbConfig(prev => ({ ...prev, nocodbApiKey: e.target.value }))}
                    placeholder="Your NocoDB API key"
                  />
                </div>
                <div>
                  <Label>Sites Table ID (Optional)</Label>
                  <Input
                    value={nocodbConfig.sitesTableId}
                    onChange={(e) => setNocodbConfig(prev => ({ ...prev, sitesTableId: e.target.value }))}
                    placeholder="Table ID for spatial data"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mode Description */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                {getSystemModeDescription(newMode)}
              </p>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={switchModeMutation.isPending}
            >
              {switchModeMutation.isPending ? "Updating..." : "Update Mode"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}