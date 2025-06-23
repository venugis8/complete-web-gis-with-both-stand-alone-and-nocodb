import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, User, Table2, Settings } from "lucide-react";

interface BaseUser {
  id: number;
  baseId: number;
  username: string;
  email: string;
  name: string;
  role: string;
}

interface BaseTable {
  id: string;
  tableName: string;
  displayName: string;
  hasGeometry: boolean;
  geometryColumn?: string;
  schema: {
    columns: any[];
  };
}

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserManagementModal({ isOpen, onClose }: UserManagementModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("viewer");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading: usersLoading } = useQuery<BaseUser[]>({
    queryKey: ["/api/base/users"],
    enabled: isOpen,
  });

  // Directly fetch from NocoDB API to show real tables
  const { data: tables, isLoading: tablesLoading } = useQuery<BaseTable[]>({
    queryKey: ["nocodb-direct-tables"],
    enabled: isOpen,
    queryFn: async () => {
      try {
        // Direct NocoDB API call from frontend
        const response = await fetch("https://app.nocodb.com/api/v2/meta/bases/prxsww2l3z53hiw/tables", {
          headers: {
            'xc-token': 'WvgZorcSfG5-kS5z1yDZnNXsRNejxQBSOETUeBvo',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`NocoDB API error: ${response.status}`);
        }
        
        const nocodbData = await response.json();
        
        // Transform to our format with real table data
        const tables = nocodbData.list || [];
        
        // Fetch fields for each table using the records endpoint (like your working code)
        const tablesWithColumns = await Promise.all(
          tables.map(async (table: any) => {
            try {
              // Fetch fields by getting a sample record (working approach from your code)
              const recordsResponse = await fetch(`https://app.nocodb.com/api/v2/tables/${table.id}/records?limit=1`, {
                headers: {
                  'xc-token': 'WvgZorcSfG5-kS5z1yDZnNXsRNejxQBSOETUeBvo',
                  'Content-Type': 'application/json'
                }
              });
              
              if (!recordsResponse.ok) {
                throw new Error(`HTTP error: ${recordsResponse.status}`);
              }
              
              const recordsData = await recordsResponse.json();
              const records = recordsData.list || [];
              
              // Extract field names from first record if it exists
              let columns = [];
              if (records.length > 0) {
                const record = records[0];
                const systemFields = ['id', 'created_at', 'updated_at', 'BaseRowId'];
                const fieldNames = Object.keys(record).filter(fieldName => !systemFields.includes(fieldName));
                
                columns = fieldNames.map(fieldName => ({
                  id: fieldName,
                  column_name: fieldName,
                  title: fieldName,
                  uidt: typeof record[fieldName] === 'string' ? 'SingleLineText' : 'Number'
                }));
              }
              
              return {
                id: table.id,
                tableName: table.table_name || table.title,
                displayName: table.title || table.table_name,
                baseId: 4,
                hasGeometry: columns.some((col: any) => 
                  col.column_name?.toLowerCase().includes('geom') ||
                  col.column_name?.toLowerCase().includes('geometry')
                ) || false,
                geometryColumn: columns.find((col: any) => 
                  col.column_name?.toLowerCase().includes('geom') ||
                  col.column_name?.toLowerCase().includes('geometry')
                )?.column_name || null,
                schema: { columns },
                createdAt: new Date(),
                updatedAt: new Date()
              };
            } catch (error) {
              console.error(`Error fetching fields for table ${table.id}:`, error);
              return {
                id: table.id,
                tableName: table.table_name || table.title,
                displayName: table.title || table.table_name,
                baseId: 4,
                hasGeometry: false,
                geometryColumn: null,
                schema: { columns: [] },
                createdAt: new Date(),
                updatedAt: new Date()
              };
            }
          })
        );
        
        return tablesWithColumns;
      } catch (error) {
        console.error("Error fetching NocoDB tables:", error);
        throw error;
      }
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: { name: string; email: string; role: string; password: string }) => {
      const username = userData.email.split('@')[0]; // Generate username from email
      const authToken = localStorage.getItem('nocobase_auth_token');
      const response = await fetch("/api/base/users", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          baseId: 4, // SSC6 base ID
          username,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          password: userData.password
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create user");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base/users"] });
      setShowAddForm(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserRole("viewer");
      setNewUserPassword("");
      toast({ title: "User created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error creating user", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { userId: number; newPassword: string }) => {
      const authToken = localStorage.getItem('nocobase_auth_token');
      const response = await fetch(`/api/base/users/${data.userId}/reset-password`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          newPassword: data.newPassword
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }

      return response.json();
    },
    onSuccess: () => {
      setResetPasswordUserId(null);
      setNewPassword("");
      toast({ title: "Password reset successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error resetting password", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const setPermissionMutation = useMutation({
    mutationFn: async (data: { userId: number; tableId: string; fieldName: string; permission: string }) => {
      const authToken = localStorage.getItem('nocobase_auth_token');
      const response = await fetch("/api/base/permissions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          baseId: 4, // SSC6 base ID
          userId: data.userId,
          tableId: data.tableId,
          fieldName: data.fieldName,
          permission: data.permission
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to set permission");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Permission updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating permission", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const selectedUser = users?.find(u => u.id === selectedUserId);
  const selectedTable = tables?.find(t => t.id === selectedTableId);

  const handleCreateUser = () => {
    if (!newUserName.trim() || !newUserEmail.trim()) {
      toast({ 
        title: "Error", 
        description: "Please fill in all fields",
        variant: "destructive" 
      });
      return;
    }

    createUserMutation.mutate({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole,
      password: newUserPassword
    });
  };

  const [pendingPermissions, setPendingPermissions] = useState<{[key: string]: string}>({});

  const handlePermissionChange = (fieldName: string, permission: string) => {
    if (!selectedUserId || !selectedTableId) return;
    
    // Store locally without immediate save
    const key = `${selectedUserId}-${selectedTableId}-${fieldName}`;
    setPendingPermissions(prev => ({ ...prev, [key]: permission }));
  };

  const handleSavePermissions = () => {
    if (!selectedUserId || !selectedTableId || Object.keys(pendingPermissions).length === 0) return;
    
    // Save all pending permissions
    Object.entries(pendingPermissions).forEach(([key, permission]) => {
      const [userId, tableId, fieldName] = key.split('-');
      if (userId && tableId && fieldName) {
        setPermissionMutation.mutate({
          userId: parseInt(userId),
          tableId,
          fieldName,
          permission
        });
      }
    });
    
    // Clear pending permissions and show success
    setPendingPermissions({});
    alert("All permissions saved successfully!");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>User Management</DialogTitle>
          <DialogDescription>
            Manage users and their permissions for this base
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* Top Section - User and Table Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
            <div>
              <Label className="text-sm font-medium">Select User</Label>
              <Select value={selectedUserId?.toString() || ""} onValueChange={(value) => setSelectedUserId(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Select Table</Label>
              <Select value={selectedTableId || ""} onValueChange={(value) => setSelectedTableId(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a table..." />
                </SelectTrigger>
                <SelectContent>
                  {tables?.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button
                onClick={() => setShowAddForm(!showAddForm)}
                variant="outline"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>

          {/* User List with Reset Password */}
          {users && users.length > 0 && (
            <Card className="flex-shrink-0">
              <CardHeader>
                <CardTitle className="text-base">Manage Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                        <Badge variant="secondary" className="text-xs mt-1">{user.role}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {resetPasswordUserId === user.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="password"
                              placeholder="New password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-32"
                            />
                            <Button
                              size="sm"
                              onClick={() => resetPasswordMutation.mutate({ userId: user.id, newPassword })}
                              disabled={!newPassword || resetPasswordMutation.isPending}
                            >
                              {resetPasswordMutation.isPending ? "..." : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setResetPasswordUserId(null);
                                setNewPassword("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setResetPasswordUserId(user.id)}
                          >
                            Reset Password
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add User Form */}
          {showAddForm && (
            <Card className="flex-shrink-0">
              <CardHeader>
                <CardTitle className="text-base">Add New User</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter user name"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={newUserRole} onValueChange={setNewUserRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="commentor">Commentor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password for new user"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button 
                    onClick={handleCreateUser}
                    disabled={!newUserName || !newUserEmail || !newUserPassword || createUserMutation.isPending}
                    size="sm"
                  >
                    {createUserMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Field Permissions Section */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedUserId && selectedTableId && tables?.find(t => t.id === selectedTableId)?.schema?.columns?.length > 0 ? (
              <>
                <div className="bg-blue-50 p-4 rounded mb-4 flex-shrink-0">
                  <p className="text-sm font-medium">
                    Setting permissions for: <span className="text-blue-700">{users?.find(u => u.id === selectedUserId)?.name}</span> 
                    {' '} on table: <span className="text-blue-700">{tables?.find(t => t.id === selectedTableId)?.displayName}</span>
                  </p>
                </div>
                
                {/* Permissions Matrix - Full Width */}
                <div className="border rounded-lg flex flex-col flex-1">
                  <div className="bg-gray-100 sticky top-0">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left p-4 font-medium" style={{width: '50%'}}>Field Name</th>
                          <th className="text-center p-4 font-medium" style={{width: '16.67%'}}>View</th>
                          <th className="text-center p-4 font-medium" style={{width: '16.67%'}}>Edit</th>
                          <th className="text-center p-4 font-medium" style={{width: '16.67%'}}>Hidden</th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                  
                  <div className="flex-1 overflow-auto">
                    <table className="w-full">
                      <tbody>
                        {tables?.find(t => t.id === selectedTableId)?.schema.columns.map((column: any, index: number) => {
                          const selectedUser = users?.find(u => u.id === selectedUserId);
                          const isViewer = selectedUser?.role === 'viewer';
                          const isCommentator = selectedUser?.role === 'commentor';
                          
                          return (
                          <tr key={column.id || column.column_name} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="p-4" style={{width: '50%'}}>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{column.title || column.column_name}</span>
                                {column.uidt && (
                                  <Badge variant="outline" className="text-xs w-fit mt-1">{column.uidt}</Badge>
                                )}
                              </div>
                            </td>
                            <td className="text-center p-4" style={{width: '16.67%'}}>
                              <input
                                type="radio"
                                name={`perm-${column.column_name}`}
                                value="view"
                                defaultChecked={true}
                                onChange={() => handlePermissionChange(column.column_name, 'view')}
                                className="w-4 h-4"
                              />
                            </td>
                            {!isViewer && !isCommentator && (
                              <td className="text-center p-4" style={{width: '16.67%'}}>
                                <input
                                  type="radio"
                                  name={`perm-${column.column_name}`}
                                  value="edit"
                                  onChange={() => handlePermissionChange(column.column_name, 'edit')}
                                  className="w-4 h-4"
                                />
                              </td>
                            )}
                            {(isViewer || isCommentator) && (
                              <td className="text-center p-4 bg-gray-100" style={{width: '16.67%'}}>
                                <span className="text-gray-400 text-sm">N/A</span>
                              </td>
                            )}
                            <td className="text-center p-4" style={{width: '16.67%'}}>
                              <input
                                type="radio"
                                name={`perm-${column.column_name}`}
                                value="hidden"
                                onChange={() => handlePermissionChange(column.column_name, 'hidden')}
                                className="w-4 h-4"
                              />
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500 p-8">
                  <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">Configure Field Permissions</p>
                  <p>Select a user and table above to set field-level permissions</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button - Fixed at Bottom */}
        {selectedUserId && selectedTableId && Object.keys(pendingPermissions).length > 0 && (
          <div className="border-t p-4 flex-shrink-0">
            <Button 
              onClick={handleSavePermissions}
              className="w-full"
              size="lg"
            >
              Save Permissions ({Object.keys(pendingPermissions).length} changes)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}