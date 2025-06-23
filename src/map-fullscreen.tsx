import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser, getCurrentBase, isAuthenticated } from "@/lib/auth";

declare global {
  interface Window {
    L: any;
    wellknown?: any;
  }
}

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

export default function MapFullscreenPage() {
  const { subdomain } = useParams();
  const [, setLocation] = useLocation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  const currentUser = getCurrentUser();
  const currentBase = getCurrentBase();

  useEffect(() => {
    if (!isAuthenticated() || !currentBase || currentBase.subdomain !== subdomain) {
      setLocation(`/login/${subdomain}`);
    }
  }, [subdomain, setLocation, currentBase]);

  // Fetch tables first
  const { data: tables } = useQuery<BaseTable[]>({
    queryKey: ["/api/base/tables"],
    enabled: isAuthenticated(),
  });

  // Fetch actual records from the sites table (table ID 1) with proper authorization
  const { data: siteRecords, isLoading: recordsLoading } = useQuery<TableRecord[]>({
    queryKey: ["/api/base/tables", 1, "records"],
    queryFn: async () => {
      const token = localStorage.getItem('nocobase_auth_token');
      const response = await fetch(`/api/base/tables/1/records`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        console.error('Failed to fetch site records:', response.status, response.statusText);
        throw new Error('Failed to fetch site records');
      }
      const records = await response.json();
      console.log('Successfully fetched site records:', records.length, 'records');
      return records;
    },
    enabled: isAuthenticated(),
  });

  useEffect(() => {
    if (!mapContainerRef.current || recordsLoading) return;

    const initializeMap = async () => {
      try {
        // Load Leaflet CSS and JS
        if (!window.L) {
          const cssLink = document.createElement('link');
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(cssLink);

          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          document.head.appendChild(script);

          await new Promise((resolve) => {
            script.onload = resolve;
          });
        }

        // Load wellknown library
        if (!window.wellknown) {
          const wellknownScript = document.createElement('script');
          wellknownScript.src = 'https://unpkg.com/wellknown/wellknown.js';
          document.head.appendChild(wellknownScript);

          await new Promise((resolve) => {
            wellknownScript.onload = resolve;
          });
        }

        if (!mapInstanceRef.current && mapContainerRef.current) {
          // Create fullscreen map centered on Bangalore (where your coordinates are)
          mapInstanceRef.current = window.L.map(mapContainerRef.current, {
            center: [12.97, 77.59], // Bangalore coordinates
            zoom: 12
          });

          // Add base layer
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '© OpenStreetMap contributors'
          }).addTo(mapInstanceRef.current);

          // Create layer group
          layerGroupRef.current = window.L.layerGroup();
          layerGroupRef.current.addTo(mapInstanceRef.current);

          setIsMapInitialized(true);
        }
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initializeMap();
  }, [recordsLoading]);

  useEffect(() => {
    if (!isMapInitialized || !siteRecords || !layerGroupRef.current) return;

    console.log('Processing site records for map:', siteRecords.length);
    console.log('Sample record:', siteRecords[0]);

    // Clear existing layers
    layerGroupRef.current.clearLayers();
    
    // Use EXACT same pattern as your working NocoDB code
    const currentFeatures = siteRecords
      .filter((rec: any) => rec.geometry)
      .map((rec: any) => ({
        type: "Feature",
        geometry: window.wellknown ? window.wellknown.parse(rec.geometry) : null,
        properties: Object.keys(rec)
          .filter(key => key !== "geometry")
          .reduce((obj: any, key) => {
            obj[key] = rec[key];
            return obj;
          }, { Id: rec.id })
      }))
      .filter(Boolean);

    console.log(`Created ${currentFeatures.length} features from ${siteRecords.length} records`);

    if (currentFeatures.length > 0) {
      // Add all features to the map at once (exactly like your working code)
      const geoJsonLayer = window.L.geoJSON(currentFeatures, {
        style: {
          color: '#3388ff',
          weight: 2,
          fillOpacity: 0.4,
          fillColor: '#3388ff'
        },
        onEachFeature: (feature: any, layer: any) => {
          // Create popup content
          const popupContent = createPopupContent(feature.properties, 'geometry', 0);
          layer.bindPopup(popupContent);
          
          // Add hover effects
          layer.on('mouseover', function(e: any) {
            e.target.setStyle({ weight: 4, fillOpacity: 0.7 });
          });
          
          layer.on('mouseout', function(e: any) {
            e.target.setStyle({ weight: 2, fillOpacity: 0.4 });
          });
        }
      });

      // Add to layer group
      geoJsonLayer.addTo(layerGroupRef.current);

      // Fit map to show all features (like your working code)
      try {
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds.pad(0.1));
          console.log('Map centered on polygon bounds:', bounds);
        } else {
          console.warn('Invalid bounds, using default center');
        }
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }

      console.log(`Successfully added ${currentFeatures.length} polygons to map`);
    } else {
      console.warn('No valid geometry features found in records');
      
      // Debug: Check what's in the first few records
      siteRecords.slice(0, 3).forEach((record: any, index: number) => {
        console.log(`Record ${index}:`, record);
        console.log(`Has geometry column:`, 'geometry' in record);
        console.log(`Geometry value:`, record.geometry);
      });
    }
  }, [siteRecords, isMapInitialized]);

  // Helper functions
  const parseWKTToGeoJSON = (wkt: string): any => {
    try {
      console.log('Parsing WKT:', wkt.substring(0, 100) + '...');
      
      if (window.wellknown) {
        const geoJson = {
          type: 'Feature',
          geometry: window.wellknown.parse(wkt),
          properties: {}
        };
        console.log('Parsed with wellknown:', geoJson);
        return geoJson;
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
      if (geoJson.geometry.type === 'MultiPolygon') {
        coords.forEach((polygon: any) => {
          polygon[0].forEach(([lng, lat]: [number, number]) => bounds.push([lat, lng]));
        });
      } else if (geoJson.geometry.type === 'Polygon') {
        coords[0].forEach(([lng, lat]: [number, number]) => bounds.push([lat, lng]));
      }
    }
    return bounds;
  };

  const getFeatureColor = (record: any, index: number): string => {
    const colors = ['#3388ff', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f39c12', '#e74c3c', '#9b59b6', '#2ecc71'];
    
    // Color by table name
    if (record._tableName) {
      const hash = record._tableName.split('').reduce((a: number, b: string) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return colors[Math.abs(hash) % colors.length];
    }
    
    return colors[index % colors.length];
  };

  const createPopupContent = (record: any, geometryCol: string, index: number): string => {
    const fields = Object.keys(record)
      .filter(key => key !== 'id' && key !== geometryCol && !key.startsWith('_'))
      .slice(0, 8)
      .map(key => {
        const value = record[key];
        return `
          <div style="margin-bottom: 8px;">
            <div style="font-weight: 500; color: #7f8c8d; font-size: 12px;">${key}:</div>
            <div style="padding: 4px 8px; background: #f8f9fa; border-radius: 4px; margin-top: 2px;">${value || 'N/A'}</div>
          </div>
        `;
      })
      .join('');

    return `
      <div style="max-width: 300px; font-family: Arial, sans-serif;">
        <h4 style="margin: 0 0 12px 0; color: #2563eb; font-size: 16px; font-weight: 600;">
          ${record._tableDisplayName || 'Site'} - ${record.name || record.title || record.id}
        </h4>
        ${fields}
      </div>
    `;
  };

  if (recordsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative">
      {/* Fullscreen Map Container */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full"
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1
        }}
      ></div>

      {/* Map Title */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-md p-3">
        <h1 className="text-lg font-semibold text-gray-900">{currentBase?.name} - Map View</h1>
        <p className="text-sm text-gray-600">{siteRecords?.length || 0} records displayed</p>
      </div>

      {/* Close Button */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => window.close()}
          className="bg-white hover:bg-gray-50 rounded-lg shadow-md p-2"
          title="Close Map"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Advanced Map Controls Panel */}
      <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-md p-4 max-w-sm max-h-96 overflow-y-auto">
        <h3 className="text-sm font-semibold mb-3">Map Controls</h3>
        
        {/* Layer Controls */}
        <div className="mb-4">
          <h4 className="text-xs font-medium mb-2">Layers</h4>
          <label className="flex items-center text-xs mb-1">
            <input type="checkbox" defaultChecked className="mr-2" />
            Site Polygons ({siteRecords?.length || 0})
          </label>
          <label className="flex items-center text-xs">
            <input type="checkbox" className="mr-2" />
            Labels
          </label>
        </div>
        
        {/* Filter Controls */}
        <div className="mb-4">
          <h4 className="text-xs font-medium mb-2">Filters</h4>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600">Status:</label>
              <select className="w-full text-xs border rounded px-1 py-1">
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Area Range:</label>
              <input type="range" className="w-full" min="0" max="1000" />
            </div>
          </div>
        </div>
        
        {/* Style Controls */}
        <div className="mb-4">
          <h4 className="text-xs font-medium mb-2">Style</h4>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600">Color by:</label>
              <select className="w-full text-xs border rounded px-1 py-1">
                <option value="default">Default</option>
                <option value="status">Status</option>
                <option value="area">Area</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Opacity:</label>
              <input type="range" className="w-full" min="0" max="100" defaultValue="40" />
            </div>
          </div>
        </div>
        
        {/* Legend */}
        <div className="mb-3">
          <h4 className="text-xs font-medium mb-2">Legend</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
              <span>Site Boundaries</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
              <span>Active Sites</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
              <span>Pending Sites</span>
            </div>
          </div>
        </div>
        
        {/* Instructions */}
        <div className="text-xs text-gray-600 border-t pt-2">
          <p>• Click polygons for details</p>
          <p>• Hover for highlighting</p>
          <p>• Use filters to refine view</p>
        </div>
      </div>
      
      {/* Search/Filter Panel */}
      <div className="absolute top-4 left-64 z-10 bg-white rounded-lg shadow-md p-3 w-64">
        <input 
          type="text" 
          placeholder="Search sites..." 
          className="w-full text-sm border rounded px-2 py-1 mb-2"
        />
        <div className="flex space-x-2">
          <button className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">
            Filter
          </button>
          <button className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600">
            Clear
          </button>
          <button className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">
            Export
          </button>
        </div>
      </div>
      
      {/* Zoom Controls */}
      <div className="absolute top-20 right-4 z-10 bg-white rounded-lg shadow-md">
        <button 
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="block w-10 h-10 text-gray-600 hover:bg-gray-50 rounded-t-lg border-b"
          title="Zoom In"
        >
          +
        </button>
        <button 
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="block w-10 h-10 text-gray-600 hover:bg-gray-50 rounded-b-lg"
          title="Zoom Out"
        >
          −
        </button>
      </div>
    </div>
  );
}