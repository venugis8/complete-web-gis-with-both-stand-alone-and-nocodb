import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface BaseTable {
  id: number;
  tableName: string;
  displayName: string;
  hasGeometry: boolean;
  geometryColumn?: string;
}

interface FieldPermission {
  id: number;
  fieldName: string;
  permission: 'view' | 'edit' | 'hidden';
}

interface PermissionsMatrixProps {
  user: User;
  tables: BaseTable[];
  isLoading: boolean;
}

export default function PermissionsMatrix({ user, tables, isLoading }: PermissionsMatrixProps) {
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set([tables[0]?.id]));
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  const { data: permissions } = useQuery<FieldPermission[]>({
    queryKey: ["/api/base/users", user.id, "permissions"],
    enabled: !!user.id,
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async (data: { userId: number; tableId: number; fieldName: string; permission: string }) => {
      const response = await apiRequest("POST", "/api/base/permissions", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base/users", user.id, "permissions"] });
      toast({
        title: "Permission Updated",
        description: "Field permission has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update permission. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleTableExpansion = (tableId: number) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableId)) {
      newExpanded.delete(tableId);
    } else {
      newExpanded.add(tableId);
    }
    setExpandedTables(newExpanded);
  };

  // Get role descriptions for different user types
  const getRoleDescription = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'Full access to all features and settings';
      case 'editor':
        return 'Can edit all fields with edit permissions';
      case 'viewer':
        return 'Can only view data, no editing capabilities';
      case 'commentor':
        return 'Can view and comment, but cannot edit data';
      case 'public':
        return 'Public access for sharing data externally';
      default:
        return 'Limited access user';
    }
  };

  // Get role badge styling
  const getRoleBadgeClass = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'editor':
        return 'bg-blue-100 text-blue-800';
      case 'viewer':
        return 'bg-gray-100 text-gray-800';
      case 'commentor':
        return 'bg-yellow-100 text-yellow-800';
      case 'public':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getFieldPermission = (tableId: number, fieldName: string): string => {
    const key = `${tableId}_${fieldName}`;
    // Check pending changes first, then saved permissions
    if (pendingChanges[key]) {
      return pendingChanges[key];
    }
    const permission = permissions?.find(p => p.fieldName === fieldName && p.tableId === tableId.toString());
    return permission?.permission || 'view';
  };

  const handlePermissionChange = (tableId: number, fieldName: string, permission: string) => {
    const key = `${tableId}_${fieldName}`;
    setPendingChanges(prev => ({
      ...prev,
      [key]: permission
    }));
    setHasUnsavedChanges(true);
  };

  const saveAllPermissions = useMutation({
    mutationFn: async () => {
      const promises = Object.entries(pendingChanges).map(([key, permission]) => {
        const [tableId, fieldName] = key.split('_');
        return apiRequest("POST", "/api/base/permissions", {
          userId: user.id,
          tableId: parseInt(tableId),
          fieldName,
          permission,
        });
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base/users", user.id, "permissions"] });
      setPendingChanges({});
      setHasUnsavedChanges(false);
      toast({
        title: "Permissions Saved",
        description: "All field permissions have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save some permissions. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Get available permission options based on user role
  const getAvailablePermissions = (userRole: string) => {
    switch (userRole.toLowerCase()) {
      case 'admin':
        return ['view', 'edit', 'hidden'];
      case 'editor':
        return ['view', 'edit', 'hidden'];
      case 'viewer':
        return ['view', 'hidden']; // No edit option
      case 'commentor':
        return ['view', 'hidden']; // No edit option, can only comment
      case 'public':
        return ['view', 'hidden']; // Public users can only view or hide
      default:
        return ['view', 'hidden'];
    }
  };

  // Check if a permission option should be disabled for this user role
  const isPermissionDisabled = (userRole: string, permission: string) => {
    const availablePermissions = getAvailablePermissions(userRole);
    return !availablePermissions.includes(permission);
  };

  const getTableFields = (table: BaseTable) => {
    // Get actual fields from your sites table structure
    if (table.tableName === 'sites') {
      return [
        { name: 'id', label: 'ID', type: 'number' },
        { name: 'name', label: 'Site Name', type: 'number' },
        { name: 'width', label: 'Width', type: 'number' },
        { name: 'height', label: 'Height', type: 'number' },
        { name: 'dimension', label: 'Dimension', type: 'text' },
        { name: 'area_in_sq', label: 'Area (sq ft)', type: 'number' },
        { name: 'status', label: 'Status', type: 'text' },
        { name: 'north_to_s', label: 'North To South', type: 'text' },
        { name: 'east_to_we', label: 'East To West', type: 'text' },
        { name: 'facing', label: 'Facing Direction', type: 'text' },
        { name: 'survey_no_', label: 'Survey Number', type: 'text' },
        { name: 'document_n', label: 'Document Number', type: 'text' },
        { name: 'geometry', label: 'Location (Geometry)', type: 'geometry' },
      ];
    }
    
    // Default fields for other table types
    return [
      { name: 'id', label: 'ID', type: 'number' },
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'status', label: 'Status', type: 'text' },
    ];
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="font-medium text-gray-900 mb-2">
          Table Permissions for {user.name}
        </h3>
        <div className="flex items-center space-x-2 mb-3">
          <Badge className={getRoleBadgeClass(user.role)}>
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </Badge>
          <span className="text-sm text-gray-500">•</span>
          <span className="text-sm text-gray-600">{getRoleDescription(user.role)}</span>
        </div>
        <p className="text-sm text-gray-600">
          Configure field-level permissions based on user role capabilities.
        </p>
      </div>

      <div className="space-y-4 custom-scrollbar overflow-y-auto max-h-[60vh]">
        {tables.map((table) => {
          const isExpanded = expandedTables.has(table.id);
          const fields = getTableFields(table);

          return (
            <Card key={table.id} className="overflow-hidden">
              <CardHeader 
                className="bg-gray-50 cursor-pointer"
                onClick={() => toggleTableExpansion(table.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <i className={`${table.hasGeometry ? 'fas fa-map-marker-alt text-emerald-500' : 'fas fa-table text-gray-400'}`}></i>
                    <span className="font-medium text-gray-900">{table.displayName}</span>
                    {table.hasGeometry && (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-xs">
                        Geometry
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="rounded border-gray-300 mr-2" />
                      <span className="text-sm text-gray-700">View</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-gray-300 mr-2" />
                      <span className="text-sm text-gray-700">Edit</span>
                    </label>
                    <Button variant="ghost" size="sm">
                      <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} text-primary`}></i>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium text-gray-900">Field Name</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-900">Type</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-900">View</th>
                          {!isPermissionDisabled(user.role, 'edit') && (
                            <th className="text-center py-2 px-3 font-medium text-gray-900">Edit</th>
                          )}
                          <th className="text-center py-2 px-3 font-medium text-gray-900">Hidden</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field) => (
                          <tr 
                            key={field.name}
                            className={`border-b hover:bg-gray-50 ${
                              field.type === 'geometry' ? 'bg-emerald-50' : ''
                            }`}
                          >
                            <td className="py-3 px-3">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-900">{field.label}</span>
                                {field.type === 'geometry' && (
                                  <i className="fas fa-map-marker-alt text-emerald-500 text-xs"></i>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {field.type}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <input 
                                type="radio" 
                                name={`${table.id}_${field.name}`}
                                value="view"
                                checked={getFieldPermission(table.id, field.name) === 'view'}
                                onChange={() => handlePermissionChange(table.id, field.name, 'view')}
                                disabled={isPermissionDisabled(user.role, 'view')}
                                className="text-primary" 
                              />
                            </td>
                            {!isPermissionDisabled(user.role, 'edit') && (
                              <td className="py-3 px-3 text-center">
                                <input 
                                  type="radio" 
                                  name={`${table.id}_${field.name}`}
                                  value="edit"
                                  checked={getFieldPermission(table.id, field.name) === 'edit'}
                                  onChange={() => handlePermissionChange(table.id, field.name, 'edit')}
                                  className="text-primary" 
                                />
                              </td>
                            )}
                            <td className="py-3 px-3 text-center">
                              <input 
                                type="radio" 
                                name={`${table.id}_${field.name}`}
                                value="hidden"
                                checked={getFieldPermission(table.id, field.name) === 'hidden'}
                                onChange={() => handlePermissionChange(table.id, field.name, 'hidden')}
                                disabled={isPermissionDisabled(user.role, 'hidden')}
                                className="text-primary" 
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 mt-6 -mx-6 -mb-6">
        <div className="flex justify-end space-x-3">
          <Button 
            variant="outline"
            onClick={() => {
              setPendingChanges({});
              setHasUnsavedChanges(false);
            }}
            disabled={!hasUnsavedChanges}
          >
            Reset Changes
          </Button>
          <Button 
            onClick={() => saveAllPermissions.mutate()}
            disabled={saveAllPermissions.isPending || !hasUnsavedChanges}
            className={hasUnsavedChanges ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            {saveAllPermissions.isPending ? "Saving..." : hasUnsavedChanges ? `Save ${Object.keys(pendingChanges).length} Changes` : "All Saved"}
          </Button>
        </div>
      </div>
    </div>
  );
}
