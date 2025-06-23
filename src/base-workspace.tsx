import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import MapView from "@/components/map-view-new";
import UserManagementModal from "@/components/user-management-modal";
import NocoDBUserManagement from "@/components/nocodb-user-management";
import CsvUploadModal from "@/components/csv-upload-modal";
import ColumnManagementModal from "@/components/column-management-modal";
import DataTable from "@/components/ui/data-table-new";
import EnhancedDataTable from "@/components/enhanced-data-table";
import { getCurrentUser, getCurrentBase, isAuthenticated } from "@/lib/auth";

interface BaseTable {
  id: number;
  tableName: string;
  displayName: string;
  hasGeometry: boolean;
  geometryColumn?: string;
}

interface TableRecord {
  id: number;
  [key: string]: any;
}

export default function BaseWorkspacePage() {
  const { subdomain } = useParams();
  const [, setLocation] = useLocation();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'grid' | 'gallery' | 'calendar' | 'kanban' | 'chart' | 'map'>('grid');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  const currentUser = getCurrentUser();
  const currentBase = getCurrentBase();
  const queryClient = useQueryClient();
  
  // Check deployment mode and user type
  const isNocoDBAdmin = currentBase?.systemMode === 'nocodb' && currentUser?.role === 'admin';
  const isNocoDBUser = currentBase?.systemMode === 'nocodb' && currentUser?.role !== 'admin';
  const isStandalone = currentBase?.systemMode === 'standalone';

  useEffect(() => {
    if (!isAuthenticated() || !currentBase || currentBase.subdomain !== subdomain) {
      setLocation(`/login/${subdomain}`);
    }
  }, [subdomain, setLocation, currentBase]);

  const { data: tables, isLoading: tablesLoading } = useQuery<BaseTable[]>({
    queryKey: ["/api/base/tables"],
    enabled: isAuthenticated(),
  });

  // Get base configuration for NocoDB integration
  const { data: baseConfig } = useQuery({
    queryKey: ["/api/base/config"],
    enabled: isAuthenticated() && currentBase?.systemMode === 'nocodb',
  });

  // Fetch user permissions for current table
  const { data: userPermissions } = useQuery<any[]>({
    queryKey: ["/api/base/users", currentUser?.id, "permissions"],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const token = localStorage.getItem('nocobase_auth_token');
      const response = await fetch(`/api/base/users/${currentUser.id}/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        console.error('Failed to fetch permissions:', response.status);
        return [];
      }
      const permissions = await response.json();
      console.log('User permissions fetched:', permissions);
      return permissions;
    },
    enabled: !!currentUser?.id,
  });

  const { data: records, isLoading: recordsLoading } = useQuery<TableRecord[]>({
    queryKey: ["/api/base/tables", selectedTableId, "records"],
    queryFn: async () => {
      if (!selectedTableId) return [];
      const token = localStorage.getItem('nocobase_auth_token');
      const response = await fetch(`/api/base/tables/${selectedTableId}/records`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        console.error('Failed to fetch records:', response.status, response.statusText);
        throw new Error('Failed to fetch records');
      }
      return response.json();
    },
    enabled: !!selectedTableId,
  });

  // Fetch all geometry data for base-level map view
  const { data: allGeometryData, isLoading: geometryLoading } = useQuery<TableRecord[]>({
    queryKey: ["/api/base/geometry-data"],
    queryFn: async () => {
      if (!tables) return [];
      const token = localStorage.getItem('nocobase_auth_token');
      const geometryTables = tables.filter(t => t.hasGeometry);
      
      const allRecords: TableRecord[] = [];
      for (const table of geometryTables) {
        try {
          const response = await fetch(`/api/base/tables/${table.id}/records`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const tableRecords = await response.json();
            // Add table info to each record
            const recordsWithTable = tableRecords.map((record: any) => ({
              ...record,
              _tableName: table.tableName,
              _tableDisplayName: table.displayName,
              _geometryColumn: table.geometryColumn
            }));
            allRecords.push(...recordsWithTable);
          }
        } catch (error) {
          console.error(`Failed to fetch records for table ${table.tableName}:`, error);
        }
      }
      return allRecords;
    },
    enabled: !!tables,
  });

  const selectedTable = tables?.find(t => t.id === selectedTableId);

  useEffect(() => {
    if (tables && tables.length > 0 && !selectedTableId) {
      setSelectedTableId(tables[0].id);
    }
  }, [tables, selectedTableId]);

  if (!isAuthenticated() || !currentBase) {
    return null;
  }

  const getTableIcon = (table: BaseTable) => {
    if (table.hasGeometry) {
      return "fas fa-map-marker-alt text-emerald-500";
    }
    return "fas fa-table text-gray-400";
  };

  const getBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'default';
      case 'maintenance':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-emerald-100 text-emerald-800';
      case 'maintenance':
        return 'bg-amber-100 text-amber-800';
      default:
        return '';
    }
  };

  // Generate dynamic columns based on actual imported data with permissions
  const tableColumns = records && records.length > 0 
    ? Object.keys(records[0])
        .filter(key => key !== 'id')
        .map(key => {
          // Find permission for this field
          const fieldPermission = userPermissions?.find(p => 
            p.fieldName === key && p.tableId === selectedTableId
          );
          
          const permission = fieldPermission?.permission || 
            (currentUser?.role === 'admin' ? 'edit' : 'view');
          
          console.log(`Field ${key}: permission = ${permission}, fieldPermission =`, fieldPermission);
          
          const isGeometry = selectedTable?.geometryColumn === key || key === 'geometry';
          console.log(`Field ${key}: isGeometry = ${isGeometry}, selectedTable.geometryColumn = ${selectedTable?.geometryColumn}`);
          
          return {
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
            isGeometry,
            isBadge: key.toLowerCase().includes('status'),
            permission
          };
        })
        .filter(col => col.permission !== 'hidden') // Filter out hidden columns
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-30">
        <div className="flex flex-col h-full">
          {/* Logo and Base Info */}
          <div className="flex items-center space-x-3 p-6 border-b border-gray-200">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-database text-white text-sm"></i>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{currentBase.name}</h2>
              <p className="text-xs text-gray-500">{currentBase.subdomain}.nocobase.com</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4">
            <div className="px-4 space-y-1">
              <button className="w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg bg-gray-50 text-gray-900 transition-colors">
                <i className="fas fa-table text-primary text-sm"></i>
                <span className="font-medium">Tables</span>
              </button>
              <button 
                onClick={() => setCurrentView('map')}
                className="w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
              >
                <i className="fas fa-globe text-sm"></i>
                <span className="font-medium">Map View</span>
              </button>
              {currentUser?.role === 'admin' && (
                <button 
                  onClick={() => setIsUserModalOpen(true)}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <i className="fas fa-users text-gray-400 text-sm"></i>
                  <span className="font-medium text-gray-700">User Management</span>
                </button>
              )}
              <button className="w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg hover:bg-gray-50 transition-colors">
                <i className="fas fa-key text-gray-400 text-sm"></i>
                <span className="font-medium text-gray-700">API Tokens</span>
              </button>
              {currentUser?.role === 'admin' && (
                <button 
                  onClick={() => window.open(`/base/${subdomain}/logs`, '_blank')}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <i className="fas fa-history text-gray-400 text-sm"></i>
                  <span className="font-medium text-gray-700">Activity Logs</span>
                </button>
              )}
              <button className="w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg hover:bg-gray-50 transition-colors">
                <i className="fas fa-cog text-gray-400 text-sm"></i>
                <span className="font-medium text-gray-700">Settings</span>
              </button>
            </div>

            {/* Tables List */}
            <div className="px-4 mt-6">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3 mb-3">Tables</h3>
              <div className="space-y-1">
                {tablesLoading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="px-3 py-2">
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ))
                ) : (
                  tables?.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => setSelectedTableId(table.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                        selectedTableId === table.id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <i className={`${getTableIcon(table)} text-sm`}></i>
                      <span className="text-sm font-medium">{table.displayName}</span>
                    </button>
                  ))
                )}
                <button 
                  onClick={() => setIsCsvUploadOpen(true)}
                  className="w-full flex items-center space-x-3 px-3 py-2 mt-3 text-left rounded-lg hover:bg-gray-50 transition-colors border-2 border-dashed border-gray-200"
                >
                  <i className="fas fa-upload text-gray-400 text-sm"></i>
                  <span className="text-sm font-medium text-gray-500">Import CSV</span>
                </button>
              </div>
            </div>
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <img 
                src="https://images.unsplash.com/photo-1494790108755-2616b612b47c?ixlib=rb-4.0.3&w=32&h=32&fit=crop&crop=face" 
                alt="User avatar" 
                className="w-8 h-8 rounded-full"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">{currentUser?.name}</p>
                <p className="text-xs text-gray-500">{currentUser?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="ml-64 flex flex-col h-screen">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <nav className="flex items-center space-x-2 text-sm">
                <span className="text-gray-500">Tables</span>
                <i className="fas fa-chevron-right text-gray-300 text-xs"></i>
                <span className="font-medium text-gray-900">
                  {selectedTable?.displayName || 'Loading...'}
                </span>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              {currentUser?.role === 'admin' && (
                <Button 
                  onClick={() => window.open(`/base/${subdomain}/master`, '_blank')}
                  className="bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  <i className="fas fa-database mr-2"></i>
                  Master Admin
                </Button>
              )}
              <Button 
                onClick={() => setIsColumnModalOpen(true)}
                variant="outline"
                size="sm"
              >
                <i className="fas fa-columns mr-2"></i>
                Manage Columns
              </Button>
              <Button>
                <i className="fas fa-plus mr-2"></i>
                Add Record
              </Button>
              <Button variant="ghost" size="sm">
                <i className="fas fa-search"></i>
              </Button>
              <Button variant="ghost" size="sm">
                <i className="fas fa-filter"></i>
              </Button>
            </div>
          </div>
        </header>

        {/* View Tabs and Content */}
        <div className="flex-1 flex flex-col bg-white">
          {/* View Type Tabs - Hide for NocoDB admins, show for everyone else */}
          {!isNocoDBAdmin && (
            <div className="border-b border-gray-200 px-6">
              <nav className="flex space-x-8">
                <button 
                  onClick={() => setCurrentView('grid')}
                  className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    currentView === 'grid'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <i className="fas fa-th mr-2"></i>Grid
                </button>
                <button 
                  onClick={() => setCurrentView('gallery')}
                  className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    currentView === 'gallery'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <i className="fas fa-th-large mr-2"></i>Gallery
                </button>
                <button 
                  onClick={() => setCurrentView('calendar')}
                  className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    currentView === 'calendar'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <i className="fas fa-calendar mr-2"></i>Calendar
                </button>
                <button 
                  onClick={() => setCurrentView('kanban')}
                  className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    currentView === 'kanban'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <i className="fas fa-columns mr-2"></i>Kanban
                </button>
                <button 
                  onClick={() => setCurrentView('chart')}
                  className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    currentView === 'chart'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <i className="fas fa-chart-bar mr-2"></i>Chart
                </button>
                <button 
                  onClick={() => setCurrentView('map')}
                  className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    currentView === 'map'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <i className="fas fa-globe mr-2"></i>Map
                </button>
              </nav>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-auto">
            {currentView === 'grid' && selectedTable && (
              <div className="p-6">
                <EnhancedDataTable
                  tableId={String(selectedTable.id)}
                  tableName={selectedTable.displayName}
                  data={records || []}
                  columns={tableColumns.map(col => ({
                    name: col.key,
                    type: 'text',
                    required: false
                  }))}
                  fieldPermissions={userPermissions || []}
                  isLoading={recordsLoading}
                  onRecordUpdate={(recordId, updates) => {
                    // Handle record updates
                    console.log('Record update:', recordId, updates);
                  }}
                />
              </div>
            )}

            {currentView === 'gallery' && (
              <div className="p-6">
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Gallery View</h3>
                  <Button size="sm" variant="outline">
                    <i className="fas fa-plus mr-2"></i>Add Record
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {records?.map((record, index) => (
                    <Card key={record.id || index} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          {tableColumns.slice(0, 3).map((col) => (
                            <div key={col.key}>
                              <span className="text-xs font-medium text-gray-500">{col.label}:</span>
                              <p className="text-sm text-gray-900 truncate">
                                {col.isGeometry ? '📍 Location' : String(record[col.key] || '-')}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t flex justify-end">
                          <Button size="sm" variant="ghost">
                            <i className="fas fa-edit"></i>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {currentView === 'calendar' && (
              <div className="p-6">
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Calendar View</h3>
                  <Button size="sm" variant="outline">
                    <i className="fas fa-plus mr-2"></i>Add Event
                  </Button>
                </div>
                <div className="bg-white rounded-lg border">
                  <div className="grid grid-cols-7 gap-0 border-b">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="p-3 text-center font-medium text-gray-700 border-r last:border-r-0">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0">
                    {Array.from({ length: 35 }, (_, i) => (
                      <div key={i} className="h-24 border-r border-b last:border-r-0 p-1">
                        <div className="text-xs text-gray-500">{((i % 31) + 1)}</div>
                        {records?.slice(i, i + 1).map((record, idx) => (
                          <div key={idx} className="mt-1 p-1 bg-blue-100 text-xs rounded truncate">
                            {String(record[tableColumns[0]?.key] || 'Event')}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentView === 'kanban' && (
              <div className="p-6">
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Kanban View</h3>
                  <Button size="sm" variant="outline">
                    <i className="fas fa-plus mr-2"></i>Add Card
                  </Button>
                </div>
                <div className="flex space-x-4 overflow-x-auto">
                  {['To Do', 'In Progress', 'Review', 'Done'].map((status) => (
                    <div key={status} className="flex-shrink-0 w-80">
                      <div className="bg-gray-100 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">{status}</h4>
                        <div className="space-y-3">
                          {records?.slice(0, 3).map((record, index) => (
                            <Card key={record.id || index} className="cursor-pointer hover:shadow-md transition-shadow">
                              <CardContent className="p-3">
                                <div className="space-y-2">
                                  {tableColumns.slice(0, 2).map((col) => (
                                    <div key={col.key}>
                                      <span className="text-xs font-medium text-gray-500">{col.label}:</span>
                                      <p className="text-sm text-gray-900">
                                        {col.isGeometry ? '📍 Location' : String(record[col.key] || '-')}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          <Button variant="ghost" className="w-full text-gray-500 border-2 border-dashed">
                            <i className="fas fa-plus mr-2"></i>Add Card
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}



            {currentView === 'chart' && (
              <div className="p-6">
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Chart View</h3>
                  <Button size="sm" variant="outline">
                    <i className="fas fa-cog mr-2"></i>Configure Chart
                  </Button>
                </div>
                <div className="bg-white rounded-lg border p-8 text-center">
                  <i className="fas fa-chart-bar text-4xl text-gray-400 mb-4"></i>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Chart Configuration</h4>
                  <p className="text-gray-600">Select chart type and data fields to visualize your data.</p>
                </div>
              </div>
            )}

            {currentView === 'map' && (
              <div className="h-full flex flex-col">
                <div className="p-6 border-b">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Map View - All Geographic Data</h3>
                    <div className="flex items-center space-x-4">
                      <Badge variant="secondary">
                        {tables?.filter(t => t.hasGeometry).length || 0} Geographic Tables
                      </Badge>
                      <Badge variant="outline">
                        {records?.length || 0} Records
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  {selectedTableId ? (
                    <MapView 
                      data={records || []}
                      columns={tableColumns}
                      isLoading={recordsLoading}
                      tableId={selectedTableId}
                      onRecordUpdate={async (recordId, updates) => {
                        try {
                          const response = await fetch(`/api/base/tables/${selectedTableId}/records/${recordId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updates)
                          });
                          
                          if (!response.ok) {
                            throw new Error('Failed to update record');
                          }
                          
                          // Refetch the data to update the map
                          await queryClient.invalidateQueries({
                            queryKey: ["/api/base/tables", selectedTableId, "records"]
                          });
                        } catch (error) {
                          console.error('Error updating record:', error);
                          throw error;
                        }
                      }}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl mb-4">🗺️</div>
                        <h3 className="text-lg font-medium mb-2">Select a Table</h3>
                        <p className="text-gray-600 mb-4">
                          Choose a table with geographic data from the sidebar to view it on the map.
                        </p>
                        <div className="text-sm text-gray-500">
                          Tables with geometry: {tables?.filter(t => t.hasGeometry).map(t => t.displayName).join(', ') || 'None'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Management Modal - conditional based on system mode */}
      {currentBase?.systemMode === 'nocodb' ? (
        <NocoDBUserManagement 
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
          baseConfig={baseConfig || {
            nocodbUrl: '',
            nocodbApiKey: '',
            nocodbBaseId: '',
            nocodbAdminEmail: '',
            nocodbAdminPassword: ''
          }}
        />
      ) : (
        <UserManagementModal 
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
        />
      )}

      {/* CSV Upload Modal */}
      <CsvUploadModal 
        isOpen={isCsvUploadOpen}
        onClose={() => setIsCsvUploadOpen(false)}
      />

      {/* Column Management Modal */}
      {selectedTable && (
        <ColumnManagementModal
          isOpen={isColumnModalOpen}
          onClose={() => setIsColumnModalOpen(false)}
          tableId={selectedTable.id}
          tableName={selectedTable.displayName}
          currentColumns={selectedTable.schema?.columns || []}
        />
      )}
    </div>
  );
}
