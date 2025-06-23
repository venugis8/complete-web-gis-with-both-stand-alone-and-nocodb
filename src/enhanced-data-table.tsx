import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  Edit, 
  Plus, 
  Trash2, 
  Search, 
  Save, 
  X, 
  SortAsc, 
  SortDesc,
  Settings,
  Check
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

interface Column {
  name: string;
  type: 'text' | 'longtext' | 'integer' | 'float' | 'image' | 'document' | 'select_one' | 'select_multiple' | 'date';
  required?: boolean;
  selectOptions?: string[];
}

interface FieldPermission {
  fieldName: string;
  permission: 'view' | 'edit' | 'hidden';
}

interface EnhancedDataTableProps {
  tableId: string;
  tableName: string;
  data: any[];
  columns: Column[];
  fieldPermissions: FieldPermission[];
  isLoading: boolean;
  onRecordUpdate?: (recordId: string, updates: any) => void;
}

type ColumnType = 'text' | 'longtext' | 'integer' | 'float' | 'image' | 'document' | 'select_one' | 'select_multiple' | 'date';

const columnTypeLabels: Record<ColumnType, string> = {
  text: "Text",
  longtext: "Long Text",
  integer: "Integer",
  float: "Decimal",
  image: "Image",
  document: "Document",
  select_one: "Select One",
  select_multiple: "Select Multiple",
  date: "Date"
};

export default function EnhancedDataTable({ 
  tableId, 
  tableName, 
  data, 
  columns, 
  fieldPermissions,
  isLoading,
  onRecordUpdate 
}: EnhancedDataTableProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCell, setEditingCell] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showDeleteColumns, setShowDeleteColumns] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [newColumn, setNewColumn] = useState<Column>({ name: "", type: "text", selectOptions: [] });
  const [newRow, setNewRow] = useState<Record<string, any>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedColumnsToDelete, setSelectedColumnsToDelete] = useState<string[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  // Helper functions
  const getFieldPermission = (fieldName: string): 'view' | 'edit' | 'hidden' => {
    const permission = fieldPermissions.find(fp => fp.fieldName === fieldName);
    return permission?.permission || 'view';
  };

  const visibleColumns = columns.filter(column => getFieldPermission(column.name) !== 'hidden');

  // Sorting and filtering
  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter(record => {
      // Search filter
      if (searchTerm) {
        const searchMatch = Object.values(record).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (!searchMatch) return false;
      }

      // Column filters
      for (const [columnName, filterValue] of Object.entries(filters)) {
        if (filterValue && !String(record[columnName] || "").toLowerCase().includes(filterValue.toLowerCase())) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.field];
        const bVal = b[sortConfig.field];
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, filters, sortConfig]);

  // Update record mutation
  const updateRecordMutation = useMutation({
    mutationFn: async ({ recordId, updates }: { recordId: string; updates: any }) => {
      const response = await fetch(`/api/base/tables/${tableId}/records/${recordId}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('sessionToken')}` 
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update record");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/base/tables/${tableId}/records`] });
      setEditingCell(null);
      setEditValue("");
      toast({ title: "Record updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update record", variant: "destructive" });
    },
  });

  // Add column mutation
  const addColumnMutation = useMutation({
    mutationFn: async (column: Column) => {
      const response = await fetch(`/api/base/tables/${tableId}/columns`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('sessionToken')}` 
        },
        body: JSON.stringify({ column }),
      });
      if (!response.ok) throw new Error("Failed to add column");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base/tables"] });
      queryClient.invalidateQueries({ queryKey: [`/api/base/tables/${tableId}/records`] });
      setShowAddColumn(false);
      setNewColumn({ name: "", type: "text", selectOptions: [] });
      toast({ title: "Column added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add column", variant: "destructive" });
    },
  });

  // Delete columns mutation
  const deleteColumnsMutation = useMutation({
    mutationFn: async (columnNames: string[]) => {
      for (const columnName of columnNames) {
        const response = await fetch(`/api/base/tables/${tableId}/columns/${columnName}`, {
          method: "DELETE",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem('sessionToken')}` 
          },
        });
        if (!response.ok) throw new Error(`Failed to delete column ${columnName}`);
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base/tables"] });
      queryClient.invalidateQueries({ queryKey: [`/api/base/tables/${tableId}/records`] });
      setShowDeleteColumns(false);
      setSelectedColumnsToDelete([]);
      toast({ title: "Columns deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete columns", variant: "destructive" });
    },
  });

  // Add row mutation
  const addRowMutation = useMutation({
    mutationFn: async (record: any) => {
      const response = await fetch(`/api/base/tables/${tableId}/records`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('sessionToken')}` 
        },
        body: JSON.stringify(record),
      });
      if (!response.ok) throw new Error("Failed to add record");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/base/tables/${tableId}/records`] });
      setShowAddRow(false);
      setNewRow({});
      toast({ title: "Record added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add record", variant: "destructive" });
    },
  });

  // Event handlers
  const handleSort = (field: string) => {
    setSortConfig(prev => {
      if (prev?.field === field) {
        return prev.direction === 'asc' ? { field, direction: 'desc' } : null;
      }
      return { field, direction: 'asc' };
    });
  };

  const handleCellUpdate = (recordId: string, fieldName: string, value: string) => {
    updateRecordMutation.mutate({ recordId, updates: { [fieldName]: value } });
  };

  const handleAddColumn = () => {
    if (!newColumn.name) {
      toast({ title: "Column name is required", variant: "destructive" });
      return;
    }
    addColumnMutation.mutate(newColumn);
  };

  const handleDeleteColumns = () => {
    if (selectedColumnsToDelete.length === 0) {
      toast({ title: "Please select columns to delete", variant: "destructive" });
      return;
    }
    deleteColumnsMutation.mutate(selectedColumnsToDelete);
  };

  const handleAddRow = () => {
    addRowMutation.mutate(newRow);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-80 h-9"
            />
          </div>
          <Button
            variant={isEditMode ? "default" : "outline"}
            onClick={() => setIsEditMode(!isEditMode)}
            className="h-9"
          >
            <Edit className="h-4 w-4 mr-2" />
            {isEditMode ? "Exit Edit" : "Edit Mode"}
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setShowAddRow(true)}
            className="h-9"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Row
          </Button>

          {isAdmin && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowAddColumn(true)}
                className="h-9"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Column
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteColumns(true)}
                className="h-9"
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage Columns
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {/* Filter Row */}
            <div className="p-3 border-b bg-gray-50/50 sticky top-0 z-10">
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, 1fr)` }}>
                {visibleColumns.map((column) => (
                  <Input
                    key={column.name}
                    placeholder={`Filter ${column.name}...`}
                    value={filters[column.name] || ""}
                    onChange={(e) => setFilters(prev => ({ ...prev, [column.name]: e.target.value }))}
                    className="h-8 text-xs"
                  />
                ))}
              </div>
            </div>

            {/* Table */}
            <Table>
              <TableHeader className="sticky top-[65px] bg-white z-10">
                <TableRow>
                  {visibleColumns.map((column) => {
                    const permission = getFieldPermission(column.name);
                    const canEdit = permission === 'edit' && isEditMode;
                    
                    return (
                      <TableHead 
                        key={column.name}
                        className={`h-10 px-3 ${canEdit ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div 
                            className="cursor-pointer flex items-center space-x-1 flex-1"
                            onClick={() => handleSort(column.name)}
                          >
                            <span className="font-medium text-sm">{column.name}</span>
                            {sortConfig?.field === column.name && (
                              sortConfig.direction === 'asc' ? 
                                <SortAsc className="h-3 w-3" /> : 
                                <SortDesc className="h-3 w-3" />
                            )}
                          </div>
                          {canEdit && (
                            <Badge variant="secondary" className="text-xs px-1 py-0 h-5">
                              Edit
                            </Badge>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length} className="text-center py-8 text-gray-500">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedData.map((record, index) => (
                    <TableRow key={record.id || index} className="h-9 hover:bg-gray-50/50">
                      {visibleColumns.map((column) => {
                        const permission = getFieldPermission(column.name);
                        const canEdit = permission === 'edit' && isEditMode;
                        const isEditing = editingCell?.recordId === String(record.id) && editingCell?.fieldName === column.name;
                        
                        return (
                          <TableCell 
                            key={column.name}
                            className={`h-9 px-3 py-1 ${canEdit ? 'bg-blue-50/50' : ''} ${isEditing ? 'ring-1 ring-blue-500' : ''}`}
                          >
                            {isEditing ? (
                              <div className="flex items-center space-x-1">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-7 text-xs border-blue-500"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleCellUpdate(String(record.id), column.name, editValue);
                                    } else if (e.key === 'Escape') {
                                      setEditingCell(null);
                                      setEditValue("");
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleCellUpdate(String(record.id), column.name, editValue)}
                                  className="h-7 w-7 p-0"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingCell(null);
                                    setEditValue("");
                                  }}
                                  className="h-7 w-7 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div 
                                className={`text-sm truncate ${canEdit ? 'cursor-pointer hover:bg-blue-100/50 rounded px-1 py-0.5' : ''}`}
                                onClick={() => {
                                  if (canEdit) {
                                    setEditingCell({ recordId: String(record.id), fieldName: column.name });
                                    setEditValue(String(record[column.name] || ""));
                                  }
                                }}
                                title={String(record[column.name] || "")}
                              >
                                {record[column.name] || "-"}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add Column Modal */}
      <Dialog open={showAddColumn} onOpenChange={setShowAddColumn}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Column</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="columnName">Column Name</Label>
              <Input
                id="columnName"
                value={newColumn.name}
                onChange={(e) => setNewColumn(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter column name"
              />
            </div>
            <div>
              <Label htmlFor="columnType">Column Type</Label>
              <Select 
                value={newColumn.type} 
                onValueChange={(value: ColumnType) => setNewColumn(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(columnTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddColumn(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddColumn} disabled={addColumnMutation.isPending}>
              {addColumnMutation.isPending ? "Adding..." : "Add Column"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Columns Modal */}
      <Dialog open={showDeleteColumns} onOpenChange={setShowDeleteColumns}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Columns</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {columns.map((column) => (
                <div key={column.name} className="flex items-center space-x-2 p-2 border rounded">
                  <Checkbox
                    checked={selectedColumnsToDelete.includes(column.name)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedColumnsToDelete(prev => [...prev, column.name]);
                      } else {
                        setSelectedColumnsToDelete(prev => prev.filter(name => name !== column.name));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{column.name}</div>
                    <div className="text-sm text-gray-500">{columnTypeLabels[column.type]}</div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteColumns(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteColumns} 
              disabled={deleteColumnsMutation.isPending || selectedColumnsToDelete.length === 0}
            >
              {deleteColumnsMutation.isPending ? "Deleting..." : `Delete ${selectedColumnsToDelete.length} Column(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Row Modal */}
      <Dialog open={showAddRow} onOpenChange={setShowAddRow}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Add New Record</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-4">
              {visibleColumns.map((column) => (
                <div key={column.name}>
                  <Label htmlFor={column.name}>{column.name}</Label>
                  {column.type === 'longtext' ? (
                    <textarea
                      id={column.name}
                      value={newRow[column.name] || ""}
                      onChange={(e) => setNewRow(prev => ({ ...prev, [column.name]: e.target.value }))}
                      className="w-full min-h-20 p-2 border rounded-md"
                      placeholder={`Enter ${column.name}`}
                    />
                  ) : column.type === 'select_one' && column.selectOptions ? (
                    <Select 
                      value={newRow[column.name] || ""}
                      onValueChange={(value) => setNewRow(prev => ({ ...prev, [column.name]: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${column.name}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {column.selectOptions.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={column.name}
                      type={column.type === 'integer' || column.type === 'float' ? 'number' : 
                            column.type === 'date' ? 'date' : 'text'}
                      value={newRow[column.name] || ""}
                      onChange={(e) => setNewRow(prev => ({ ...prev, [column.name]: e.target.value }))}
                      placeholder={`Enter ${column.name}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRow(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRow} disabled={addRowMutation.isPending}>
              {addRowMutation.isPending ? "Adding..." : "Add Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}