import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import * as d3 from 'd3';

// Dynamically import react-leaflet components with SSR disabled
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(mod => mod.CircleMarker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

// Import MarkerClusterGroup from react-leaflet-markercluster dynamically
const MarkerClusterGroup = dynamic(() => import('react-leaflet-markercluster').then(mod => mod.MarkerClusterGroup), { ssr: false });

const CrimeMap = () => {
  const [crimeData, setCrimeData] = useState([]);
  const [filteredCrimeData, setFilteredCrimeData] = useState([]);
  const [selectedCrimeType, setSelectedCrimeType] = useState('');
  const [isClient, setIsClient] = useState(false);
  const mapRef = useRef(null); // Reference to the map container

  useEffect(() => {
    setIsClient(true); // Set isClient to true once the component is mounted on the client
  }, []);

  // Load crime data when the component mounts
  useEffect(() => {
    const loadCrimeData = async () => {
      const data = await d3.csv("dataset/Annual_Crime_Dataset_2015withLongLad.csv");
      const parsedData = data.slice(0,3)
        .map(d => ({
          lat: parseFloat(d.Latitude),
          lng: parseFloat(d.Longitude),
          crimeType: d['GO Highest Offense Desc'],
          reportDate: d['GO Report Date'],
        }))
        .filter(d => !isNaN(d.lat) && !isNaN(d.lng));  // Only keep rows with valid coordinates
      console.log("parsedData:", parsedData)


      setCrimeData(parsedData);
      setFilteredCrimeData(parsedData);  // Initially show all data
      
    };

    loadCrimeData();
  }, []);

  // Handle crime type change
  const handleCrimeTypeChange = (event) => {
    const crimeType = event.target.value;
    setSelectedCrimeType(crimeType);

    if (crimeType) {
      const filtered = crimeData.filter(crime => crime.crimeType === crimeType);
      setFilteredCrimeData(filtered);
    } else {
      setFilteredCrimeData(crimeData);  // Show all data if no type is selected
    }
  };

  // Fetch and load crime data when bounds change
  useEffect(() => {
    if (isClient && mapRef.current) {
      const map = mapRef.current.leafletElement;

      if (map) {
        // Initial load of visible data
        const bounds = map.getBounds();
        loadCrimeDataInBounds(bounds);

        // Load data whenever bounds change
        map.on('moveend', () => {
          const bounds = map.getBounds();
          loadCrimeDataInBounds(bounds);
        });
      }
    }
  }, [isClient]);

  if (!isClient) {
    return <div>Loading map...</div>;  // Avoid rendering map until the component is mounted on the client
  }

  if (filteredCrimeData.length === 0) {
    return <div>Loading...</div>;  // Show loading state until crime data is fetched
  }

  // Get unique crime types for the dropdown
  const crimeTypes = Array.from(new Set(crimeData.map(crime => crime.crimeType)));


  console.log("filteredCrimeData:", filteredCrimeData);
  //filteredCrimeData = filteredCrimeData.slice(0,10);

  return (
    <div style={{ height: '600px' }}>
      <div style={{ marginBottom: '10px' }}>
        <select value={selectedCrimeType} onChange={handleCrimeTypeChange}>
          <option value="">All Crime Types</option>
          {crimeTypes.map((crimeType, index) => (
            <option key={index} value={crimeType}>{crimeType}</option>
          ))}
        </select>
      </div>

      {/* Render map only after client-side rendering */}
      <MapContainer
        center={[30.2672, -97.7431]} // Austin, Texas Coordinates
        zoom={13}  // Adjust zoom level to focus on Austin
        style={{ height: '100vh', width: '100%' }}
        ref={mapRef}
        scrollWheelZoom={true}  // Disable zooming with the mouse wheel
        dragging={true}         // Disable dragging the map
        touchZoom={false}        // Disable pinch-to-zoom on touch devices
        zoomControl={false}      // Remove zoom control buttons
        doubleClickZoom={false}  // Disable double-click zoom
      >
        {/* Use OpenStreetMap as a lightweight alternative */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          //attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Marker clustering for improved performance */}
        <MarkerClusterGroup>
          {filteredCrimeData.map((crime, index) => (
            <CircleMarker
              key={index}
              center={[crime.lat, crime.lng]}
              radius={6}  // Small circle for the crime marker
              fillOpacity={1.0}
              color="red"
              fillColor="red"
            >
              <Popup>
                <strong>{crime.crimeType}</strong><br />
                Reported on: {crime.reportDate}<br />
                Location: {crime.lat.toFixed(4)}, {crime.lng.toFixed(4)}
              </Popup>
            </CircleMarker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
};

export default CrimeMap;
