import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import * as d3 from 'd3';

// Dynamically load the leaflet map component (with SSR disabled)
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(mod => mod.CircleMarker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

// Dynamically load leaflet CSS (important for map styling)
import 'leaflet/dist/leaflet.css';

const CrimeMap = () => {
  const [crimeData, setCrimeData] = useState([]); // State to store crime data
  const [loading, setLoading] = useState(true);  // State to handle loading

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await d3.csv("/dataset/Annual_Crime_Dataset_2015withLongLad.csv");
        console.log("Raw Data:", data);

        const processedData = data
          .map(d => ({
            lat: parseFloat(d.Latitude),
            lng: parseFloat(d.Longitude),
            crimeType: d['GO Highest Offense Desc'],
            reportDate: d['GO Report Date']
          }))
          .filter(d => !isNaN(d.lat) && !isNaN(d.lng)); 

        console.log("Filtered Crime Data:", processedData);
        setCrimeData(processedData);
      } catch (error) {
        console.error("Error fetching the CSV data:", error);
      } finally {
        setLoading(false); // Ensure loading is stopped after processing
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div>Loading map data...</div>;
  }

  return (
    <div style={{ width: '80%', height: '500px', margin: '0 auto', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer center={[30.2672, -97.7431]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {crimeData.map((crime, index) => (
          <CircleMarker
            key={index}
            center={[crime.lat, crime.lng]}  // Latitude and longitude
            radius={6}                       // Radius of the circle
            fillOpacity={0.7}                // Opacity of the circle fill
            color="red"                      // Border color of the circle
            fillColor="red"                  // Fill color of the circle
          >
            <Popup>
              <strong>{crime.crimeType}</strong><br />
              Reported on: {crime.reportDate}<br />
              Location: {crime.lat.toFixed(4)}, {crime.lng.toFixed(4)}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};

export default CrimeMap;
