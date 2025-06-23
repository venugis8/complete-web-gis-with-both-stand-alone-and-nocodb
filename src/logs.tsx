import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser, getCurrentBase, isAuthenticated } from "@/lib/auth";
import { format } from "date-fns";

interface EditLog {
  id: number;
  userId: number;
  tableId: number;
  recordId: number;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  action: 'create' | 'update' | 'delete';
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  };
  table: {
    displayName: string;
    tableName: string;
  };
}

interface BaseTable {
  id: number;
  tableName: string;
  displayName: string;
}

export default function LogsPage() {
  const { subdomain } = useParams();
  const [, setLocation] = useLocation();
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const currentUser = getCurrentUser();
  const currentBase = getCurrentBase();

  useEffect(() => {
    if (!isAuthenticated() || !currentBase || currentBase.subdomain !== subdomain) {
      setLocation(`/login/${subdomain}`);
    }
  }, [subdomain, setLocation, currentBase]);

  // Check if user is admin
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      setLocation(`/base/${subdomain}`);
    }
  }, [currentUser, subdomain, setLocation]);

  const { data: tables, isLoading: tablesLoading } = useQuery<BaseTable[]>({
    queryKey: ["/api/base/tables"],
    enabled: isAuthenticated() && currentUser?.role === 'admin',
  });

  const { data: logs, isLoading: logsLoading } = useQuery<EditLog[]>({
    queryKey: ["/api/base/logs", selectedTableId],
    enabled: isAuthenticated() && currentUser?.role === 'admin',
  });

  if (!isAuthenticated() || !currentBase || currentUser?.role !== 'admin') {
    return null;
  }

  // Filter logs based on search term and action
  const filteredLogs = logs?.filter(log => {
    const matchesSearch = searchTerm === "" || 
      log.fieldName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    
    return matchesSearch && matchesAction;
  }) || [];

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return <Badge className="bg-green-100 text-green-800">Created</Badge>;
      case 'update':
        return <Badge className="bg-blue-100 text-blue-800">Updated</Badge>;
      case 'delete':
        return <Badge className="bg-red-100 text-red-800">Deleted</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const formatValue = (value: string | null) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">empty</span>;
    }
    if (value.length > 50) {
      return <span title={value}>{value.substring(0, 50)}...</span>;
    }
    return value;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={() => setLocation(`/base/${subdomain}`)}
              className="text-gray-600"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back to Base
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
              <p className="text-sm text-gray-600">Track all field changes made by users</p>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <Input
              placeholder="Search by field name, user, or table..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
          <Select value={selectedTableId?.toString() || "all"} onValueChange={(value) => setSelectedTableId(value === "all" ? null : parseInt(value))}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Tables" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tables</SelectItem>
              {tables?.map((table) => (
                <SelectItem key={table.id} value={table.id.toString()}>
                  {table.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Created</SelectItem>
              <SelectItem value="update">Updated</SelectItem>
              <SelectItem value="delete">Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Field Edit History</span>
              <Badge variant="outline">{filteredLogs.length} entries</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-history text-gray-300 text-4xl mb-4"></i>
                <h3 className="text-lg font-medium text-gray-900">No activity logs found</h3>
                <p className="text-gray-600">No field changes have been recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Old Value</TableHead>
                      <TableHead>New Value</TableHead>
                      <TableHead>Record ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{log.user.name || 'Unknown'}</div>
                            <div className="text-xs text-gray-500">{log.user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{log.table.displayName}</TableCell>
                        <TableCell className="font-mono text-sm">{log.fieldName}</TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate">{formatValue(log.oldValue)}</div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate">{formatValue(log.newValue)}</div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">#{log.recordId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}