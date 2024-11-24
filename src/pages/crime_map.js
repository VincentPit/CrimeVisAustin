import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';  // For dynamic import in Next.js
import * as d3 from 'd3';

// Dynamically import react-leaflet components (disabling SSR for Leaflet)
const MapWithNoSSR = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(mod => mod.CircleMarker), { ssr: false });

const CrimeMap = () => {
  const [crimeData, setCrimeData] = useState([]);
  const [filteredCrimeData, setFilteredCrimeData] = useState([]);
  const [selectedCrimeType, setSelectedCrimeType] = useState('');


  //30.2938° N, 97.7329° W
  // Load the crime data only after the component mounts
  useEffect(() => {
    const loadCrimeData = async () => {
      const data = await d3.csv("dataset/Annual_Crime_Dataset_2015withLongLad.csv");  // Update path to your CSV
      const parsedData = data
        .map(d => ({
          lat: parseFloat(d.Latitude),
          lng: parseFloat(d.Longitude),
          crimeType: d['GO Highest Offense Desc'],
          reportDate: d['GO Report Date'],
        }))
        .filter(d => !isNaN(d.lat) && !isNaN(d.lng));  // Only keep rows with valid coordinates

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
      console.log(filtered);
      setFilteredCrimeData(filtered);
    } else {
      setFilteredCrimeData(crimeData);  // Show all data if no type is selected
    }
  };

  if (filteredCrimeData.length === 0) {
    return <div>Loading...</div>;  // Show loading state until crime data is fetched
  }

  // Get unique crime types for the dropdown
  const crimeTypes = Array.from(new Set(crimeData.map(crime => crime.crimeType)));

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

      <MapWithNoSSR
        center={[30.2672, -97.7431]} // Austin, Texas Coordinates
        zoom={12}  // Adjust zoom level to focus on Austin
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CartoDB</a> contributors'
        />
        {filteredCrimeData.map((crime, index) => (
          <CircleMarker
            key={index}
            center={[crime.lat, crime.lng]}
            radius={6}  // Small circle for the crime marker
            fillOpacity={0.7}
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
      </MapWithNoSSR>
    </div>
  );
};

export default CrimeMap;
