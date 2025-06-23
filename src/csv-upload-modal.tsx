import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

interface Column {
  name: string;
  type: 'text' | 'number' | 'date' | 'geometry';
  sample?: string;
}

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CsvUploadModal({ isOpen, onClose }: CsvUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [tableName, setTableName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [preview, setPreview] = useState<string[][]>([]);
  const [geometryColumn, setGeometryColumn] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (data: {
      tableName: string;
      displayName: string;
      columns: Column[];
      records: any[];
      hasGeometry: boolean;
      geometryColumn?: string;
    }) => {
      // First create the table
      const tableResponse = await apiRequest("POST", "/api/base/tables", {
        tableName: data.tableName,
        displayName: data.displayName,
        hasGeometry: data.hasGeometry,
        geometryColumn: data.geometryColumn,
        schema: {
          fields: data.columns.map(col => ({
            name: col.name,
            type: col.type,
            primary: col.name === 'id'
          }))
        }
      });

      const table = await tableResponse.json();

      // Then upload the records
      await apiRequest("POST", `/api/base/tables/${table.id}/records/bulk`, {
        records: data.records
      });

      return table;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base/tables"] });
      toast({
        title: "CSV Uploaded Successfully",
        description: "Your data has been imported and the table created.",
      });
      onClose();
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload CSV. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFile(null);
    setTableName("");
    setDisplayName("");
    setColumns([]);
    setPreview([]);
    setGeometryColumn("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      parseCSV(selectedFile);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid CSV file.",
        variant: "destructive",
      });
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Invalid CSV",
          description: "CSV file must have at least a header and one data row.",
          variant: "destructive",
        });
        return;
      }

      // Parse CSV properly handling quoted fields (for geometry data with commas)
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              // Handle escaped quotes
              current += '"';
              i++; // Skip next quote
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const sampleData = lines.slice(1, 6).map(line => parseCSVLine(line));

      // Auto-detect column types
      const detectedColumns: Column[] = headers.map((header, index) => {
        const samples = sampleData.map(row => row[index]).filter(Boolean);
        let type: 'text' | 'number' | 'date' | 'geometry' = 'text';

        // Check if it looks like coordinates (lat,lng or similar)
        if (samples.some(sample => /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(sample))) {
          type = 'geometry';
        }
        // Check if it's numeric
        else if (samples.every(sample => !isNaN(Number(sample)))) {
          type = 'number';
        }
        // Check if it's a date
        else if (samples.some(sample => !isNaN(Date.parse(sample)))) {
          type = 'date';
        }

        return {
          name: header.toLowerCase().replace(/\s+/g, '_'),
          type,
          sample: samples[0] || ''
        };
      });

      setColumns(detectedColumns);
      setPreview([headers, ...sampleData]);
      
      // Auto-detect geometry column
      const geoCol = detectedColumns.find(col => col.type === 'geometry');
      if (geoCol) {
        setGeometryColumn(geoCol.name);
      }

      // Auto-generate table name from file name
      const baseName = file.name.replace('.csv', '').toLowerCase().replace(/\s+/g, '_');
      setTableName(baseName);
      setDisplayName(file.name.replace('.csv', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    };
    reader.readAsText(file);
  };

  const updateColumnType = (index: number, type: Column['type']) => {
    const newColumns = [...columns];
    newColumns[index].type = type;
    setColumns(newColumns);

    // Update geometry column if needed
    if (type === 'geometry' && !geometryColumn) {
      setGeometryColumn(newColumns[index].name);
    } else if (type !== 'geometry' && geometryColumn === newColumns[index].name) {
      setGeometryColumn("");
    }
  };

  const handleUpload = () => {
    if (!file || !tableName || !displayName || columns.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and select a CSV file.",
        variant: "destructive",
      });
      return;
    }

    // Parse the full CSV for upload
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Use the same CSV parsing function to handle quoted geometry fields
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        
        result.push(current.trim());
        return result;
      };
      
      const headers = parseCSVLine(lines[0]);
      
      const records = lines.slice(1).map((line, index) => {
        const values = parseCSVLine(line);
        const record: any = { id: index + 1 };
        
        headers.forEach((header, i) => {
          const column = columns.find(col => 
            col.name === header.toLowerCase().replace(/\s+/g, '_')
          );
          const value = values[i] || '';
          
          if (column) {
            switch (column.type) {
              case 'number':
                record[column.name] = value ? Number(value) : null;
                break;
              case 'date':
                if (value && value.trim()) {
                  try {
                    const date = new Date(value);
                    record[column.name] = isNaN(date.getTime()) ? value : date.toISOString();
                  } catch {
                    record[column.name] = value;
                  }
                } else {
                  record[column.name] = null;
                }
                break;
              default:
                record[column.name] = value;
            }
          }
        });
        
        return record;
      });

      uploadMutation.mutate({
        tableName,
        displayName,
        columns: [
          { name: 'id', type: 'number' },
          ...columns
        ],
        records,
        hasGeometry: !!geometryColumn,
        geometryColumn: geometryColumn || undefined
      });
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Import CSV Data</DialogTitle>
          <DialogDescription>
            Upload a CSV file to create a new table with your data. The system will auto-detect column types and geometry fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csvFile">CSV File</Label>
            <Input
              id="csvFile"
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          {file && (
            <>
              {/* Table Configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tableName">Table Name</Label>
                  <Input
                    id="tableName"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="customers"
                  />
                </div>
                <div>
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Customers"
                  />
                </div>
              </div>

              {/* Column Configuration */}
              {columns.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Column Configuration</Label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    {columns.map((column, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex-1">
                          <span className="font-medium">{column.name}</span>
                          {column.sample && (
                            <p className="text-xs text-gray-500">Sample: {column.sample}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <select
                            value={column.type}
                            onChange={(e) => updateColumnType(index, e.target.value as Column['type'])}
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="geometry">Geometry</option>
                          </select>
                          {column.type === 'geometry' && (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-xs">
                              Map Ready
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Geometry Column Selection */}
              {geometryColumn && (
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-map-marker-alt text-emerald-600"></i>
                    <span className="text-sm font-medium text-emerald-800">
                      Geometry field detected: {geometryColumn}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-600 mt-1">
                    This table will be available in Map view with location visualization.
                  </p>
                </div>
              )}

              {/* Preview */}
              {preview.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Data Preview</Label>
                  <div className="mt-2 border rounded-md overflow-hidden">
                    <div className="overflow-x-auto max-h-48 custom-scrollbar">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {preview[0]?.map((header, index) => (
                              <th key={index} className="px-3 py-2 text-left font-medium text-gray-700 border-r border-gray-200">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.slice(1).map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t border-gray-200">
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="px-3 py-2 text-gray-600 border-r border-gray-200">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 flex-shrink-0 bg-white">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload}
            disabled={!file || !tableName || !displayName || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? "Uploading..." : "Import CSV"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}