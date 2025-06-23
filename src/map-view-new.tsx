import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";

declare global {
  interface Window {
    L: any;
    wellknown?: any;
  }
}

interface Column {
  key: string;
  label: string;
  isGeometry?: boolean;
  permission?: 'view' | 'edit' | 'hidden';
}

interface MapViewProps {
  data: any[];
  columns: Column[];
  isLoading: boolean;
  tableId?: string;
  onRecordUpdate?: (recordId: string, updates: any) => void;
}

export default function MapView({ data, columns, isLoading, tableId, onRecordUpdate }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [filterField, setFilterField] = useState<string>('');
  const [filterValue, setFilterValue] = useState<string>('');
  const [colorField, setColorField] = useState<string>('');
  const [labelField, setLabelField] = useState<string>('');
  const [baseMapType, setBaseMapType] = useState<string>('osm');
  const [editingFeature, setEditingFeature] = useState<any>(null);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [legendItems, setLegendItems] = useState<Array<{value: string, color: string, count: number, visible: boolean}>>([]);
  const [hiddenValues, setHiddenValues] = useState<Set<string>>(new Set());
  const [measurementMode, setMeasurementMode] = useState<'none' | 'line' | 'area'>('none');
  const [measurementLayers, setMeasurementLayers] = useState<any[]>([]);
  const [measurementUnits, setMeasurementUnits] = useState<'metric' | 'imperial'>('metric');

  // Filter columns based on permissions - only show visible columns
  const visibleColumns = columns.filter(col => col.permission !== 'hidden');
  const editableColumns = visibleColumns.filter(col => col.permission === 'edit' && !col.isGeometry);
  const geometryColumns = columns.filter(col => col.isGeometry);

  useEffect(() => {
    if (!mapContainerRef.current || isLoading) return;

    const initializeMap = async () => {
      try {
        // Load Leaflet CSS and JS if not already loaded
        if (!window.L) {
          // Add CSS
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(cssLink);

          // Add custom CSS for better styling
          const additionalCSS = document.createElement('style');
          additionalCSS.textContent = `
            .leaflet-container {
              height: 100% !important;
              width: 100% !important;
              background: #aad3df;
            }
            .map-controls {
              position: absolute;
              top: 10px;
              right: 10px;
              z-index: 1000;
              background: white;
              padding: 15px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              min-width: 250px;
            }
            .map-table-toggle {
              position: absolute;
              bottom: 10px;
              left: 50%;
              transform: translateX(-50%);
              z-index: 1000;
            }
            .map-attribute-table {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              background: white;
              max-height: 300px;
              overflow-y: auto;
              z-index: 1000;
              border-top: 1px solid #ddd;
              display: none;
            }
            .map-attribute-table.visible {
              display: block;
            }
            .popup-field {
              margin: 8px 0;
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .popup-label {
              font-weight: 500;
              color: #7f8c8d;
              font-size: 12px;
            }
            .popup-value {
              padding: 6px;
              border: 1px solid #ddd;
              border-radius: 4px;
              background: #f8f9fa;
              font-size: 13px;
            }
            .popup-input {
              width: 100%;
              padding: 6px;
              border: 1px solid #3498db;
              border-radius: 4px;
              font-size: 13px;
            }
            .popup-actions {
              display: flex;
              justify-content: flex-end;
              gap: 8px;
              margin-top: 10px;
            }
            .popup-btn {
              padding: 6px 12px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            }
            .popup-edit-btn {
              background: #3498db;
              color: white;
            }
            .popup-save-btn {
              background: #2ecc71;
              color: white;
            }
            .popup-cancel-btn {
              background: #95a5a6;
              color: white;
            }
          `;
          document.head.appendChild(additionalCSS);

          // Add JS
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          document.head.appendChild(script);

          await new Promise((resolve) => {
            script.onload = resolve;
          });
        }

        // Load wellknown library for WKT parsing
        if (!window.wellknown) {
          const wellknownScript = document.createElement('script');
          wellknownScript.src = 'https://cdn.jsdelivr.net/npm/wellknown@0.5.0/wellknown.js';
          document.head.appendChild(wellknownScript);

          await new Promise((resolve, reject) => {
            wellknownScript.onload = resolve;
            wellknownScript.onerror = () => {
              console.warn('Failed to load wellknown from CDN, will use manual parser');
              resolve();
            };
            setTimeout(() => {
              console.warn('Timeout loading wellknown, continuing without it');
              resolve();
            }, 5000);
          });
        }

        // Initialize map
        if (!mapInstanceRef.current && mapContainerRef.current) {
          const container = mapContainerRef.current;
          container.style.height = '100%';
          container.style.width = '100%';
          
          mapInstanceRef.current = window.L.map(container, {
            center: [12.97, 77.59], // Default to Bangalore
            zoom: 10,
            preferCanvas: false,
            attributionControl: true
          });

          // Add base layers
          const baseLayers: Record<string, any> = {
            osm: window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 18,
              attribution: '© OpenStreetMap contributors'
            }),
            'google-satellite': window.L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
              maxZoom: 20,
              attribution: '© Google'
            }),
            'google-hybrid': window.L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
              maxZoom: 20,
              attribution: '© Google'
            }),
            'google-streets': window.L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
              maxZoom: 20,
              attribution: '© Google'
            })
          };
          
          mapInstanceRef.current.baseLayers = baseLayers;
          baseLayers[baseMapType].addTo(mapInstanceRef.current);

          // Create layer group for features
          layerGroupRef.current = window.L.layerGroup();
          layerGroupRef.current.addTo(mapInstanceRef.current);
          
          setTimeout(() => {
            mapInstanceRef.current.invalidateSize(true);
          }, 10);
          
          setIsMapInitialized(true);
          console.log('Map initialized successfully');
        }
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initializeMap();
  }, [isLoading]);

  useEffect(() => {
    if (!isMapInitialized || !data || !layerGroupRef.current) return;

    // Clear existing layers
    layerGroupRef.current.clearLayers();
    
    let featuresAdded = 0;
    const bounds: [number, number][] = [];

    // Process each record and add to map
    console.log('Processing data for map:', { totalRecords: data.length, geometryColumns: geometryColumns.map(c => c.key) });
    
    data.forEach((record, index) => {
      // Find geometry columns for this record
      const recordGeometryColumns = geometryColumns.filter(col => record[col.key]);
      if (index < 3) { // Log first 3 records for debugging
        console.log(`Record ${index + 1}:`, record);
        console.log('Geometry columns found:', recordGeometryColumns);
        console.log('All record keys:', Object.keys(record));
      }
      
      recordGeometryColumns.forEach(geometryCol => {
        const geomData = record[geometryCol.key];
        console.log(`Geometry data for column "${geometryCol.key}":`, geomData, 'Type:', typeof geomData);
        
        if (geomData) {
          try {
            // Check if it's WKT format - handle various polygon formats
            let cleanGeomData = '';
            if (typeof geomData === 'string') {
              cleanGeomData = geomData.trim().toUpperCase();
            } else {
              console.log('Non-string geometry data:', typeof geomData, geomData);
              // Skip non-string geometry data for now
              return;
            }
            
            if (cleanGeomData.startsWith('POLYGON') || cleanGeomData.startsWith('MULTIPOLYGON')) {
              console.log('Detected WKT format:', geomData.substring(0, 100) + '...');
              
              // Use manual parser as primary method since wellknown is unreliable
              let geometry = null;
              try {
                // Try manual parsing first since we know the exact format
                geometry = parseMultiPolygonManually(geomData);
                console.log('Manual parsing result:', geometry);
                
                // Fallback to wellknown if manual parsing fails
                if (!geometry && window.wellknown && typeof window.wellknown === 'function') {
                  try {
                    geometry = window.wellknown(geomData);
                    console.log('Wellknown fallback result:', geometry);
                  } catch (e) {
                    console.warn('Wellknown fallback failed:', e);
                  }
                }
                
                console.log('Final parsed geometry:', geometry);
              } catch (e) {
                console.warn('Invalid WKT:', geomData, e);
              }
              
              if (geometry) {
                const feature = {
                  type: "Feature",
                  geometry,
                  properties: record
                };
                
                console.log('Creating layer from feature:', feature);
                const layer = window.L.geoJSON(feature, {
                  style: {
                    color: getFeatureColor(record, index),
                    weight: 2,
                    fillOpacity: 0.3,
                    fillColor: getFeatureColor(record, index)
                  },
                  onEachFeature: (feature: any, layer: any) => {
                    const popupContent = createPopupContent(record, geometryCol.key);
                    layer.bindPopup(popupContent);
                    layer.record = record;
                    layer.geometryColumn = geometryCol.key;
                    
                    layer.on('mouseover', function(e: any) {
                      e.target.setStyle({ weight: 3, fillOpacity: 0.7 });
                    });
                    
                    layer.on('mouseout', function(e: any) {
                      e.target.setStyle({ weight: 2, fillOpacity: 0.3 });
                    });

                    layer.on('click', function(e: any) {
                      setSelectedRecord(record);
                      setSelectedFeature(record);
                    });
                    
                    // Store reference to record for zoom functionality
                    layer.record = record;
                  }
                });
                
                // Ensure layer group exists and add layer
                if (layerGroupRef.current && mapInstanceRef.current) {
                  layer.addTo(layerGroupRef.current);
                  console.log('Layer added to map successfully');
                  
                  // Calculate bounds from geometry
                  const layerBounds = layer.getBounds();
                  if (layerBounds.isValid()) {
                    const sw = layerBounds.getSouthWest();
                    const ne = layerBounds.getNorthEast();
                    bounds.push([sw.lat, sw.lng], [ne.lat, ne.lng]);
                  }
                  featuresAdded++;
                  
                  // Add label if label field is selected
                  if (labelField && labelField !== 'none' && record[labelField]) {
                    const center = layerBounds.getCenter();
                    const labelText = String(record[labelField]);
                    const label = window.L.marker(center, {
                      icon: window.L.divIcon({
                        className: 'map-label',
                        html: `<div style="background: rgba(0,0,0,0.8); color: white; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 500; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">${labelText}</div>`,
                        iconSize: [labelText.length * 7 + 8, 18],
                        iconAnchor: [labelText.length * 3.5 + 4, 9]
                      })
                    });
                    label.addTo(layerGroupRef.current);
                  }
                } else {
                  console.error('Layer group or map instance not available');
                }
              }
            } else {
              // Try to parse as coordinate pair
              const coords = parseCoordinates(geomData);
              
              if (coords && coords.length === 2) {
                const [lat, lng] = coords;
                
                const marker = window.L.circleMarker([lat, lng], {
                  radius: 8,
                  fillColor: getFeatureColor(record, index),
                  color: '#ffffff',
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.8
                });
                
                const popupContent = createPopupContent(record, geometryCol.key);
                marker.bindPopup(popupContent);
                marker.record = record;
                marker.geometryColumn = geometryCol.key;
                
                marker.on('click', function(e: any) {
                  setSelectedFeature(record);
                });
                
                marker.addTo(layerGroupRef.current);
                bounds.push([lat, lng]);
                featuresAdded++;
              }
            }
          } catch (error) {
            console.error('Error processing geometry for record:', record, error);
          }
        }
      });
    });

    // Fit map to show all features
    if (bounds.length > 0 && mapInstanceRef.current && layerGroupRef.current) {
      console.log('Fitting map to bounds:', bounds.length, 'coordinate pairs');
      
      // Try using the layer group bounds first
      const layers = layerGroupRef.current.getLayers();
      console.log('Number of layers in group:', layers.length);
      
      if (layers.length > 0) {
        const group = new window.L.featureGroup(layers);
        const groupBounds = group.getBounds();
        console.log('Group bounds:', groupBounds);
        
        if (groupBounds.isValid()) {
          mapInstanceRef.current.fitBounds(groupBounds.pad(0.1));
          console.log('Map fitted to group bounds');
        } else {
          console.log('Group bounds invalid, trying manual bounds');
          // Fallback to manual bounds calculation
          if (bounds.length >= 2) {
            const latitudes = bounds.map(b => b[0]);
            const longitudes = bounds.map(b => b[1]);
            const sw = [Math.min(...latitudes), Math.min(...longitudes)];
            const ne = [Math.max(...latitudes), Math.max(...longitudes)];
            mapInstanceRef.current.fitBounds([sw, ne] as any);
            console.log('Map fitted to manual bounds:', sw, ne);
          }
        }
      } else {
        console.log('No layers found in group');
      }
    } else {
      console.log('No bounds to fit or map/layer group not available');
    }

    console.log(`Added ${featuresAdded} features to map from ${data.length} records`);
  }, [data, isMapInitialized, visibleColumns, geometryColumns]);

  // Handle base map changes
  useEffect(() => {
    if (mapInstanceRef.current && mapInstanceRef.current.baseLayers) {
      // Remove current base layer
      mapInstanceRef.current.eachLayer((layer: any) => {
        if (layer.options && (layer.options.attribution?.includes('OpenStreetMap') || layer.options.attribution?.includes('Google'))) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });
      
      // Add new base layer
      mapInstanceRef.current.baseLayers[baseMapType].addTo(mapInstanceRef.current);
    }
  }, [baseMapType]);

  // Generate legend data when color field or data changes
  useEffect(() => {
    generateLegendData();
  }, [colorField, data]);

  // Update layer visibility when hidden values change
  useEffect(() => {
    updateLayerVisibility(hiddenValues);
  }, [hiddenValues]);

  // Helper functions

  const parseMultiPolygonManually = (wkt: string): any => {
    try {
      console.log('Using manual MultiPolygon parser for:', wkt);
      console.log('WKT length:', wkt.length);
      
      // Check if WKT appears to be truncated (missing closing parentheses)
      if (wkt.toUpperCase().includes('MULTIPOLYGON') && !wkt.includes(')))')) {
        console.warn('WKT appears to be truncated - missing closing parentheses');
        console.warn('Expected format: MultiPolygon (((coords)))');
        console.warn('Actual data:', wkt);
        return null;
      }
      
      // Handle both MULTIPOLYGON and POLYGON formats
      let coordString = '';
      let isMultiPolygon = false;
      
      if (wkt.toUpperCase().includes('MULTIPOLYGON')) {
        isMultiPolygon = true;
        // Extract from MultiPolygon: MULTIPOLYGON (((coords)))
        // Handle the specific format: MultiPolygon (((77.824698 12.670096, 77.8247 12.670117, ...)))
        const match = wkt.match(/MULTIPOLYGON\s*\(\s*\(\s*\(\s*([^)]+)\s*\)\s*\)\s*\)/i);
        if (match) {
          coordString = match[1];
          console.log('Extracted coordinate string:', coordString);
        } else {
          console.log('Failed to match MultiPolygon pattern');
        }
      } else if (wkt.toUpperCase().includes('POLYGON')) {
        // Extract from Polygon: POLYGON ((coords))
        const match = wkt.match(/POLYGON\s*\(\s*\(\s*([^)]+)\s*\)\s*\)/i);
        if (match) {
          coordString = match[1];
          console.log('Extracted coordinate string:', coordString);
        } else {
          console.log('Failed to match Polygon pattern');
        }
      }
      
      if (!coordString) {
        console.error('Could not extract coordinates from WKT:', wkt);
        return null;
      }
      
      console.log('Extracted coordinate string:', coordString.substring(0, 100) + '...');
      
      // Parse coordinate pairs
      const coordPairs = coordString.split(',').map(pair => {
        const coords = pair.trim().split(/\s+/);
        const lng = parseFloat(coords[0]);
        const lat = parseFloat(coords[1]);
        
        if (isNaN(lng) || isNaN(lat)) {
          console.warn('Invalid coordinate pair:', pair);
          return null;
        }
        
        return [lng, lat]; // [lng, lat] for GeoJSON format
      }).filter(pair => pair !== null);
      
      if (coordPairs.length < 3) {
        console.error('Not enough valid coordinates for polygon');
        return null;
      }
      
      // Close the ring if not already closed
      const firstPoint = coordPairs[0];
      const lastPoint = coordPairs[coordPairs.length - 1];
      if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        coordPairs.push([firstPoint[0], firstPoint[1]]);
      }
      
      console.log('Parsed coordinate pairs:', coordPairs.length, 'points');
      
      // Return GeoJSON geometry
      if (isMultiPolygon) {
        return {
          type: "MultiPolygon",
          coordinates: [[coordPairs]]
        };
      } else {
        return {
          type: "Polygon", 
          coordinates: [coordPairs]
        };
      }
    } catch (error) {
      console.error('Manual parsing failed:', error);
      return null;
    }
  };

  const parseWKTToGeoJSON = (wkt: string): any => {
    try {
      console.log('Parsing WKT:', wkt.substring(0, 100) + '...');
      
      if (window.wellknown) {
        // Normalize WKT case sensitivity
        let normalizedWkt = wkt.trim();
        normalizedWkt = normalizedWkt.replace(/^multipolygon/i, 'MULTIPOLYGON');
        normalizedWkt = normalizedWkt.replace(/^polygon/i, 'POLYGON');
        
        const geometry = window.wellknown(normalizedWkt);
        console.log('Parsed geometry:', geometry);
        
        if (geometry) {
          const geoJson = {
            type: 'Feature',
            geometry: geometry,
            properties: {}
          };
          console.log('Created GeoJSON:', geoJson);
          return geoJson;
        }
      }
      
      // Enhanced manual parsing for MultiPolygon
      if (wkt.toUpperCase().includes('MULTIPOLYGON')) {
        // Remove MULTIPOLYGON wrapper and extra parentheses
        const content = wkt.replace(/MULTIPOLYGON\s*\(\s*\(\s*/i, '').replace(/\s*\)\s*\)$/i, '');
        
        // Split by coordinate pairs and parse
        const coordStrings = content.split(',');
        const coordinates = [];
        const polygon = [];
        
        for (const coordStr of coordStrings) {
          const coords = coordStr.trim().split(/\s+/).map(Number);
          if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            polygon.push([coords[0], coords[1]]);
          }
        }
        
        if (polygon.length > 0) {
          // Close the polygon if not already closed
          if (polygon[0][0] !== polygon[polygon.length - 1][0] || 
              polygon[0][1] !== polygon[polygon.length - 1][1]) {
            polygon.push([polygon[0][0], polygon[0][1]]);
          }
          
          coordinates.push([polygon]);
          
          const geoJson = {
            type: 'Feature',
            geometry: { 
              type: 'MultiPolygon', 
              coordinates: coordinates 
            },
            properties: {}
          };
          
          console.log('Manually parsed MultiPolygon:', geoJson);
          return geoJson;
        }
      }
      
      // Try parsing as regular Polygon
      if (wkt.toUpperCase().includes('POLYGON')) {
        const content = wkt.replace(/POLYGON\s*\(\s*\(\s*/i, '').replace(/\s*\)\s*\)$/i, '');
        const coordStrings = content.split(',');
        const coordinates = [];
        
        for (const coordStr of coordStrings) {
          const coords = coordStr.trim().split(/\s+/).map(Number);
          if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            coordinates.push([coords[0], coords[1]]);
          }
        }
        
        if (coordinates.length > 0) {
          // Close the polygon if not already closed
          if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
              coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
            coordinates.push([coordinates[0][0], coordinates[0][1]]);
          }
          
          const geoJson = {
            type: 'Feature',
            geometry: { 
              type: 'Polygon', 
              coordinates: [coordinates] 
            },
            properties: {}
          };
          
          console.log('Manually parsed Polygon:', geoJson);
          return geoJson;
        }
      }
    } catch (error) {
      console.error('Error parsing WKT:', wkt, error);
    }
    return null;
  };

  const getBoundsFromGeoJSON = (geoJson: any): [number, number][] => {
    const bounds: [number, number][] = [];
    if (geoJson.geometry && geoJson.geometry.coordinates) {
      const coords = geoJson.geometry.coordinates;
      
      if (geoJson.geometry.type === 'Polygon') {
        coords[0].forEach(([lng, lat]: [number, number]) => bounds.push([lat, lng]));
      } else if (geoJson.geometry.type === 'MultiPolygon') {
        coords.forEach((polygon: any) => {
          polygon[0].forEach(([lng, lat]: [number, number]) => bounds.push([lat, lng]));
        });
      }
    }
    return bounds;
  };

  const parseCoordinates = (coordString: any): [number, number] | null => {
    if (!coordString) return null;
    
    const str = String(coordString).trim();
    
    try {
      if (str.includes('POINT')) {
        const match = str.match(/POINT\s*\(\s*([^)]+)\s*\)/i);
        if (match) {
          const coords = match[1].split(/\s+/).map(Number);
          if (coords.length >= 2) {
            return [coords[1], coords[0]]; // [lat, lng]
          }
        }
      } else if (str.includes(',')) {
        const parts = str.split(',').map(s => parseFloat(s.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          if (Math.abs(parts[0]) <= 90) {
            return [parts[0], parts[1]]; // [lat, lng]
          } else {
            return [parts[1], parts[0]]; // [lat, lng]
          }
        }
      }
    } catch (error) {
      console.warn('Error parsing coordinates:', coordString, error);
    }
    
    return null;
  };

  const getFeatureColor = (record: any, index: number): string => {
    const colors = ['#3388ff', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f39c12', '#e74c3c', '#9b59b6', '#2ecc71'];
    
    // If color field is selected, use that for coloring
    if (colorField && colorField !== 'default' && record[colorField]) {
      const value = String(record[colorField] || 'No value');
      return getColorForValue(value, colorField);
    }
    
    return colors[index % colors.length];
  };

  const createPopupContent = (record: any, geometryCol: string): string => {
    const fields = visibleColumns
      .filter(col => col.key !== 'id' && col.key !== geometryCol && col.key !== 'Id')
      .slice(0, 6)
      .map(col => {
        const value = record[col.key];
        const canEdit = col.permission === 'edit';
        
        return `
          <div class="popup-field">
            <div class="popup-label">${col.label}:</div>
            <div class="popup-value" data-field="${col.key}" data-editable="${canEdit}">
              ${value || 'N/A'}
            </div>
            ${canEdit ? `<input type="text" class="popup-input" data-field="${col.key}" value="${value || ''}" style="display: none;">` : ''}
          </div>
        `;
      })
      .join('');

    const hasEditableFields = editableColumns.length > 0;

    return `
      <div style="max-width: 300px; font-family: Arial, sans-serif;">
        <h4 style="margin: 0 0 12px 0; color: #2563eb; font-size: 16px; font-weight: 600;">
          ${record.name || record.title || record['Site No'] || `Record ${record.Id || record.id}`}
        </h4>
        <div class="popup-fields">
          ${fields}
        </div>
        ${hasEditableFields ? `
          <div class="popup-actions">
            <button class="popup-btn popup-edit-btn" onclick="window.startEditFeature('${record.Id || record.id}')">
              Edit
            </button>
            <button class="popup-btn popup-save-btn" onclick="window.saveFeature('${record.Id || record.id}')" style="display: none;">
              Save
            </button>
            <button class="popup-btn popup-cancel-btn" onclick="window.cancelEdit()" style="display: none;">
              Cancel
            </button>
          </div>
        ` : ''}
      </div>
    `;
  };

  // Set up global functions for popup interactions
  useEffect(() => {
    window.startEditFeature = (recordId: string) => {
      const popup = document.querySelector('.leaflet-popup-content');
      if (popup) {
        popup.querySelectorAll('.popup-value[data-editable="true"]').forEach(el => {
          const field = el.getAttribute('data-field');
          const input = popup.querySelector(`.popup-input[data-field="${field}"]`) as HTMLInputElement;
          if (input) {
            el.style.display = 'none';
            input.style.display = 'block';
            input.focus();
          }
        });
        
        popup.querySelector('.popup-edit-btn').style.display = 'none';
        popup.querySelector('.popup-save-btn').style.display = 'inline-block';
        popup.querySelector('.popup-cancel-btn').style.display = 'inline-block';
      }
      setEditingFeature(recordId);
    };

    window.saveFeature = async (recordId: string) => {
      const popup = document.querySelector('.leaflet-popup-content');
      if (popup && onRecordUpdate) {
        const updates: any = {};
        
        popup.querySelectorAll('.popup-input').forEach(input => {
          const field = input.getAttribute('data-field');
          const value = (input as HTMLInputElement).value;
          if (field) {
            updates[field] = value;
          }
        });
        
        try {
          await onRecordUpdate(recordId, updates);
          
          // Update the popup display
          popup.querySelectorAll('.popup-input').forEach(input => {
            const field = input.getAttribute('data-field');
            const value = (input as HTMLInputElement).value;
            const valueEl = popup.querySelector(`.popup-value[data-field="${field}"]`);
            if (valueEl) {
              valueEl.textContent = value || 'N/A';
              valueEl.style.display = 'block';
              input.style.display = 'none';
            }
          });
          
          popup.querySelector('.popup-edit-btn').style.display = 'inline-block';
          popup.querySelector('.popup-save-btn').style.display = 'none';
          popup.querySelector('.popup-cancel-btn').style.display = 'none';
          
        } catch (error) {
          console.error('Error saving feature:', error);
          alert('Error saving changes. Please try again.');
        }
      }
      setEditingFeature(null);
    };

    window.cancelEdit = () => {
      const popup = document.querySelector('.leaflet-popup-content');
      if (popup) {
        popup.querySelectorAll('.popup-input').forEach(input => {
          const field = input.getAttribute('data-field');
          const valueEl = popup.querySelector(`.popup-value[data-field="${field}"]`);
          if (valueEl) {
            valueEl.style.display = 'block';
            input.style.display = 'none';
          }
        });
        
        popup.querySelector('.popup-edit-btn').style.display = 'inline-block';
        popup.querySelector('.popup-save-btn').style.display = 'none';
        popup.querySelector('.popup-cancel-btn').style.display = 'none';
      }
      setEditingFeature(null);
    };

    return () => {
      delete window.startEditFeature;
      delete window.saveFeature;
      delete window.cancelEdit;
    };
  }, [onRecordUpdate]);

  const applyFilter = () => {
    if (!filterField || !filterValue) return;
    
    layerGroupRef.current?.eachLayer((layer: any) => {
      const record = layer.record || {};
      const fieldValue = record[filterField];
      if (fieldValue && fieldValue.toString().toLowerCase().includes(filterValue.toLowerCase())) {
        layer.setStyle({ opacity: 1, fillOpacity: 0.6 });
      } else {
        layer.setStyle({ opacity: 0.3, fillOpacity: 0.1 });
      }
    });
  };

  const clearFilter = () => {
    layerGroupRef.current?.eachLayer((layer: any) => {
      layer.setStyle({ opacity: 1, fillOpacity: 0.3 });
    });
    setFilterField('');
    setFilterValue('');
  };

  const zoomToRecord = (record: any) => {
    if (!layerGroupRef.current || !mapInstanceRef.current) return;
    
    // Find the layer for this record
    layerGroupRef.current.eachLayer((layer: any) => {
      if (layer.record && layer.record.Id === record.Id) {
        // Zoom to this feature
        if (layer.getBounds) {
          mapInstanceRef.current.fitBounds(layer.getBounds());
        } else if (layer.getLatLng) {
          mapInstanceRef.current.setView(layer.getLatLng(), 15);
        }
        // Select this record
        setSelectedRecord(record);
        setSelectedFeature(record);
      }
    });
  };



  // Helper function to get consistent color for a value
  const getColorForValue = (value: string, field: string): string => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#10AC84', '#EE5A24', '#0abde3', '#006ba6', '#f39801'
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Generate legend data based on color field
  const generateLegendData = () => {
    if (!colorField || colorField === 'default' || !data.length) {
      setLegendItems([]);
      return;
    }

    const valueColorMap = new Map<string, {color: string, count: number}>();
    
    data.forEach(record => {
      const value = String(record[colorField] || 'No value');
      const color = getColorForValue(value, colorField);
      
      if (valueColorMap.has(value)) {
        valueColorMap.get(value)!.count++;
      } else {
        valueColorMap.set(value, { color, count: 1 });
      }
    });

    const items = Array.from(valueColorMap.entries()).map(([value, info]) => ({
      value,
      color: info.color,
      count: info.count,
      visible: !hiddenValues.has(value)
    }));

    setLegendItems(items);
  };

  // Toggle legend item visibility
  const toggleLegendItem = (value: string) => {
    const newHiddenValues = new Set(hiddenValues);
    if (newHiddenValues.has(value)) {
      newHiddenValues.delete(value);
    } else {
      newHiddenValues.add(value);
    }
    setHiddenValues(newHiddenValues);
    
    // Update layer visibility
    updateLayerVisibility(newHiddenValues);
  };

  // Update layer visibility based on hidden values
  const updateLayerVisibility = (hiddenVals: Set<string>) => {
    if (!layerGroupRef.current || !colorField || colorField === 'default') return;

    layerGroupRef.current.eachLayer((layer: any) => {
      if (layer.record) {
        const value = String(layer.record[colorField] || 'No value');
        const isHidden = hiddenVals.has(value);
        
        if (isHidden) {
          layer.setStyle({ opacity: 0, fillOpacity: 0 });
        } else {
          layer.setStyle({ opacity: 1, fillOpacity: 0.3 });
        }
      }
    });
  };

  // Measurement tool functions
  const startMeasurement = (mode: 'line' | 'area') => {
    if (!mapInstanceRef.current) return;
    
    setMeasurementMode(mode);
    mapInstanceRef.current.getContainer().style.cursor = 'crosshair';
    
    // Clear previous measurement
    measurementLayers.forEach(layer => {
      mapInstanceRef.current.removeLayer(layer);
    });
    setMeasurementLayers([]);
    
    if (mode === 'line') {
      startLineMeasurement();
    } else {
      startAreaMeasurement();
    }
  };

  const startLineMeasurement = () => {
    let polyline: any = null;
    let points: any[] = [];
    
    const onMapClick = (e: any) => {
      points.push(e.latlng);
      
      if (points.length === 1) {
        polyline = window.L.polyline(points, { color: 'red', weight: 3 }).addTo(mapInstanceRef.current);
        setMeasurementLayers([polyline]);
      } else {
        polyline.setLatLngs(points);
        
        // Calculate distance
        const distance = calculateLineDistance(points);
        const distanceText = formatDistance(distance);
        
        // Add distance label
        const lastPoint = points[points.length - 1];
        const popup = window.L.popup()
          .setLatLng(lastPoint)
          .setContent(`Distance: ${distanceText}`)
          .openOn(mapInstanceRef.current);
      }
    };
    
    const onMapDblClick = () => {
      mapInstanceRef.current.off('click', onMapClick);
      mapInstanceRef.current.off('dblclick', onMapDblClick);
      mapInstanceRef.current.getContainer().style.cursor = '';
      setMeasurementMode('none');
    };
    
    mapInstanceRef.current.on('click', onMapClick);
    mapInstanceRef.current.on('dblclick', onMapDblClick);
  };

  const startAreaMeasurement = () => {
    let polygon: any = null;
    let points: any[] = [];
    
    const onMapClick = (e: any) => {
      points.push(e.latlng);
      
      if (points.length === 1) {
        polygon = window.L.polygon(points, { color: 'blue', weight: 3, fillOpacity: 0.2 }).addTo(mapInstanceRef.current);
        setMeasurementLayers([polygon]);
      } else {
        polygon.setLatLngs(points);
        
        if (points.length >= 3) {
          // Calculate area
          const area = calculatePolygonArea(points);
          const areaText = formatArea(area);
          
          // Add area label
          const center = polygon.getBounds().getCenter();
          const popup = window.L.popup()
            .setLatLng(center)
            .setContent(`Area: ${areaText}`)
            .openOn(mapInstanceRef.current);
        }
      }
    };
    
    const onMapDblClick = () => {
      mapInstanceRef.current.off('click', onMapClick);
      mapInstanceRef.current.off('dblclick', onMapDblClick);
      mapInstanceRef.current.getContainer().style.cursor = '';
      setMeasurementMode('none');
    };
    
    mapInstanceRef.current.on('click', onMapClick);
    mapInstanceRef.current.on('dblclick', onMapDblClick);
  };

  const calculateLineDistance = (points: any[]) => {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += points[i].distanceTo(points[i + 1]);
    }
    return total;
  };

  const calculatePolygonArea = (points: any[]) => {
    if (points.length < 3) return 0;
    
    // Use Leaflet's built-in area calculation if available
    const polygon = window.L.polygon(points);
    const bounds = polygon.getBounds();
    const approxArea = bounds.getNorth() - bounds.getSouth() * bounds.getEast() - bounds.getWest() * 111320 * 111320;
    return Math.abs(approxArea);
  };

  const formatDistance = (meters: number) => {
    if (measurementUnits === 'imperial') {
      const feet = meters * 3.28084;
      if (feet < 5280) {
        return `${feet.toFixed(2)} ft`;
      } else {
        const miles = feet / 5280;
        return `${miles.toFixed(2)} miles`;
      }
    } else {
      if (meters < 1000) {
        return `${meters.toFixed(2)} m`;
      } else {
        const km = meters / 1000;
        return `${km.toFixed(2)} km`;
      }
    }
  };

  const formatArea = (sqMeters: number) => {
    if (measurementUnits === 'imperial') {
      const sqFeet = sqMeters * 10.764;
      if (sqFeet < 43560) {
        return `${sqFeet.toFixed(2)} sq ft`;
      } else {
        const acres = sqFeet / 43560;
        return `${acres.toFixed(2)} acres`;
      }
    } else {
      if (sqMeters < 10000) {
        return `${sqMeters.toFixed(2)} sq m`;
      } else {
        const hectares = sqMeters / 10000;
        return `${hectares.toFixed(2)} hectares`;
      }
    }
  };

  const clearMeasurements = () => {
    measurementLayers.forEach(layer => {
      mapInstanceRef.current.removeLayer(layer);
    });
    setMeasurementLayers([]);
    setMeasurementMode('none');
    mapInstanceRef.current.getContainer().style.cursor = '';
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2">🗺️</div>
          <h3 className="text-lg font-medium mb-2">No Geographic Data</h3>
          <p className="text-gray-600">No records with geometry data found for map visualization.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex">
      {/* Feature Details Left Panel */}
      {selectedRecord && (
        <div className="w-80 h-full bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Feature Details</h4>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setSelectedRecord(null)}
              >
                Close
              </Button>
            </div>
            
            <div className="space-y-3">
              {columns.filter(col => col.permission === 'view' || col.permission === 'edit').map((col) => (
                <div key={col.key} className="space-y-1">
                  <label className="text-sm font-medium text-gray-600">{col.label}:</label>
                  <div className="text-sm p-2 bg-gray-50 rounded border">
                    {col.isGeometry ? (
                      <Badge variant="outline">📍 Geometry Data</Badge>
                    ) : (
                      String(selectedRecord[col.key] || 'N/A')
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div ref={mapContainerRef} className="flex-1 h-full" />
      
      {/* Map Controls */}
      <div className="map-controls">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Map Controls</h4>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                const currentUrl = window.location.href;
                const newWindow = window.open(currentUrl, '_blank');
                if (newWindow) {
                  newWindow.focus();
                }
              }}
            >
              Open in New Tab
            </Button>
          </div>
          
          {/* Base Map Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Base Map:</label>
            <Select value={baseMapType} onValueChange={setBaseMapType}>
              <SelectTrigger className="w-full h-9 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <SelectValue placeholder="Select base map..." />
              </SelectTrigger>
              <SelectContent className="border-gray-200 shadow-lg">
                <SelectItem value="osm" className="hover:bg-blue-50">OpenStreetMap</SelectItem>
                <SelectItem value="google-satellite" className="hover:bg-blue-50">Google Satellite</SelectItem>
                <SelectItem value="google-hybrid" className="hover:bg-blue-50">Google Hybrid</SelectItem>
                <SelectItem value="google-streets" className="hover:bg-blue-50">Google Streets</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Measurement Tools */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Measurement Tools:</label>
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant={measurementMode === 'line' ? 'default' : 'outline'}
                  onClick={() => measurementMode === 'line' ? clearMeasurements() : startMeasurement('line')}
                  className="flex-1"
                >
                  📏 Distance
                </Button>
                <Button
                  size="sm"
                  variant={measurementMode === 'area' ? 'default' : 'outline'}
                  onClick={() => measurementMode === 'area' ? clearMeasurements() : startMeasurement('area')}
                  className="flex-1"
                >
                  📐 Area
                </Button>
              </div>
              <div className="flex space-x-2">
                <Select value={measurementUnits} onValueChange={(value: 'metric' | 'imperial') => setMeasurementUnits(value)}>
                  <SelectTrigger className="flex-1 h-8 border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric">Metric (m, km, sq m)</SelectItem>
                    <SelectItem value="imperial">Imperial (ft, mi, sq ft, acres)</SelectItem>
                  </SelectContent>
                </Select>
                {measurementLayers.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={clearMeasurements}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {/* Filter Controls */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Filter Field:</label>
            <Select value={filterField} onValueChange={setFilterField}>
              <SelectTrigger className="w-full h-9 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent className="border-gray-200 shadow-lg">
                {columns.filter(col => col.permission === 'view' || col.permission === 'edit').map((col) => (
                  <SelectItem key={col.key} value={col.key} className="hover:bg-blue-50">
                    {col.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {filterField && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Filter Value:</label>
              <Input
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                placeholder="Enter filter value"
                className="w-full h-9 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <Button onClick={applyFilter} size="sm" className="flex-1">
                  Apply
                </Button>
                <Button onClick={clearFilter} variant="outline" size="sm" className="flex-1">
                  Clear
                </Button>
              </div>
            </div>
          )}
          
          {/* Label Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Label Field:</label>
            <Select value={labelField} onValueChange={setLabelField}>
              <SelectTrigger className="w-full h-9 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <SelectValue placeholder="No labels" />
              </SelectTrigger>
              <SelectContent className="border-gray-200 shadow-lg">
                <SelectItem value="none" className="hover:bg-blue-50">No labels</SelectItem>
                {columns.filter(col => (col.permission === 'view' || col.permission === 'edit') && !col.isGeometry).map((col) => (
                  <SelectItem key={col.key} value={col.key} className="hover:bg-blue-50">
                    {col.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Color by:</label>
            <Select value={colorField} onValueChange={setColorField}>
              <SelectTrigger className="w-full h-9 border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <SelectValue placeholder="Default colors" />
              </SelectTrigger>
              <SelectContent className="border-gray-200 shadow-lg">
                <SelectItem value="default" className="hover:bg-blue-50">Default colors</SelectItem>
                {columns.filter(col => (col.permission === 'view' || col.permission === 'edit') && !col.isGeometry).map((col) => (
                  <SelectItem key={col.key} value={col.key} className="hover:bg-blue-50">
                    {col.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interactive Legend */}
          {legendItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Legend:</label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowLegend(!showLegend)}
                >
                  {showLegend ? 'Hide' : 'Show'}
                </Button>
              </div>
              
              {showLegend && (
                <div className="space-y-1 max-h-48 overflow-y-auto bg-gray-50 rounded p-2">
                  {legendItems.map((item) => (
                    <div
                      key={item.value}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all ${
                        item.visible ? 'bg-white shadow-sm hover:shadow-md' : 'bg-gray-200 opacity-60'
                      }`}
                      onClick={() => toggleLegendItem(item.value)}
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm truncate max-w-[120px]" title={item.value}>
                          {item.value}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Badge variant="secondary" className="text-xs">
                          {item.count}
                        </Badge>
                        <span className={`text-xs font-medium ${
                          item.visible ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {item.visible ? '👁️' : '🚫'}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {legendItems.some(item => !item.visible) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => {
                        setHiddenValues(new Set());
                        setLegendItems(items => items.map(item => ({ ...item, visible: true })));
                      }}
                    >
                      Show All
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table Toggle */}
      <div className="map-table-toggle">
        <Button 
          onClick={() => setShowTable(!showTable)}
          variant="secondary"
          size="sm"
        >
          {showTable ? '▼ Hide Table' : '▲ Show Table'}
        </Button>
      </div>

      {/* Attribute Table */}
      {showTable && (
        <div className="map-attribute-table visible">
          <div className="p-4 max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {visibleColumns.map((col) => (
                    <th key={col.key} className="text-left p-2 font-medium">
                      {col.label}
                      {col.permission === 'edit' && (
                        <Badge variant="secondary" className="ml-1 text-xs">Edit</Badge>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((record, index) => (
                  <tr 
                    key={record.Id || record.id || index} 
                    className="border-b hover:bg-blue-50 cursor-pointer"
                    onClick={() => zoomToRecord(record)}
                  >
                    {visibleColumns.map((col) => (
                      <td key={col.key} className="p-2">
                        {col.isGeometry ? (
                          <Badge variant="outline">📍 Geometry</Badge>
                        ) : (
                          String(record[col.key] || '-')
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


    </div>
  );
}