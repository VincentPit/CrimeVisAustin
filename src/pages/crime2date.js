import React, { useEffect, useState } from "react";
import * as d3 from "d3";
import dynamic from 'next/dynamic';
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((mod) => mod.CircleMarker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });
import 'leaflet/dist/leaflet.css'; // Leaflet default styles


const CrimeDataChart = () => {
  const [data, setData] = useState([]);
  const [selectedCrime, setSelectedCrime] = useState("");
  const [timeRange, setTimeRange] = useState([new Date(2015, 0, 1), new Date(2015, 11, 31)]); // Default time range
  const [crimeTypes, setCrimeTypes] = useState([]);
  const [crimeDistribution, setCrimeDistribution] = useState([]); 
  const [crimeData, setCrimeData] = useState([]); 
  const [timeScale, setTimeScale] = useState("day"); // Default to day scale
  const [loading, setLoading] = useState(true);

  // Load and process the CSV data
  useEffect(() => {
    const parseDate = d3.timeParse("%d-%b-%y"); // Adjust to match "1-Jan-15" format
    d3.csv("dataset/Annual_Crime_Dataset_2015withLongLad.csv").then((rawData) => {
      const processedData = rawData
        .filter((d) => d["GO Report Date"] && d["GO Highest Offense Desc"]) // Filter valid rows
        .map((d) => ({
          date: parseDate(d["GO Report Date"].trim()),
          lat: parseFloat(d.Latitude),
          lng: parseFloat(d.Longitude),
          crimeType: d["GO Highest Offense Desc"].trim(),
        }));

      // Get unique crime types for the dropdown
      const uniqueCrimeTypes = Array.from(
        new Set(processedData.map((d) => d.crimeType))
      );

      setData(processedData);
      setCrimeTypes(uniqueCrimeTypes);
    });
  }, []);

  // Draw the chart
  useEffect(() => {
    if (data.length === 0) return; // Ensure data is loaded
    console.log("selected:", selectedCrime);
    // Filter data based on selectedCrime and timeRange
    const filteredData = data.filter(d => !isNaN(d.lat) && !isNaN(d.lng)).filter((d) => {
      const isInTimeRange =
        timeRange &&
        d.date &&
        d.date >= timeRange[0] &&
        d.date <= timeRange[1];
      const matchesCrime =
        selectedCrime && selectedCrime !== "" ? d.crimeType === selectedCrime.trim() : true; // Include all data when selectedCrime is empty
      return isInTimeRange && matchesCrime;
    });

    const clusterRadius = 0.05; // Adjust for clustering precision
  const clusters = [];

    filteredData.forEach((crime) => {
      const cluster = clusters.find(
        (c) =>
          Math.abs(c.lat - crime.lat) <= clusterRadius &&
          Math.abs(c.lng - crime.lng) <= clusterRadius
      );
      if (cluster) {
        cluster.count += 1;
      } else {
        clusters.push({ lat: crime.lat, lng: crime.lng, count: 1 });
      }
    });
  
    setCrimeData(clusters);

    //console.log("Filtered Data:", filteredData); // Debugging

    // Aggregate data based on selected time scale (day or month)
    const aggregatedData = timeScale === "day"
      ? d3.rollups(
          filteredData,
          (v) => v.length,
          (d) => d3.timeDay.floor(d.date) // Group by day
        ).map(([key, value]) => ({ date: key, count: value }))
      : d3.rollups(
          filteredData,
          (v) => v.length,
          (d) => d3.timeMonth.floor(d.date) // Group by month
        ).map(([key, value]) => ({ date: key, count: value }));

    //console.log("Aggregated Data:", aggregatedData); // Debugging

    // Remove any existing chart elements before redrawing
    d3.select("#chart").selectAll("*").remove();

    // Set chart dimensions
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = 800 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom; // Increase height for more space

    // Create SVG container
    const svg = d3
      .select("#chart")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define scales
    const x = d3
      .scaleTime()
      .domain(d3.extent(aggregatedData, (d) => d.date))
      .range([0, width]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(aggregatedData, (d) => d.count) || 1]) // Avoid zero max
      .nice()
      .range([height, 0]);

    // Add X-axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(timeScale === "day" ? 10 : 6));

    // Add Y-axis with adjusted tick spacing and rotated labels
    svg
      .append("g")
      .call(
        d3.axisLeft(y)
          .ticks(15) // Increase the number of ticks for a more spread out axis
          .tickFormat(d3.format("d")) // Format ticks as integers
      )
      .selectAll("text")
      .style("text-anchor", "middle") // Center the text
      .attr("transform", "rotate(-45)"); // Rotate Y-axis labels for better readability

    // Add bars
    svg
      .selectAll(".bar")
      .data(aggregatedData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.date))
      .attr("y", (d) => y(d.count))
      .attr("width", timeScale === "day" ? 10 : 20) // Adjust width based on time scale
      .attr("height", (d) => height - y(d.count))
      .attr("fill", "steelblue");

    // Add chart title
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .text("Crime Data Over Time");
  }, [data, selectedCrime, timeRange, timeScale]);

  // Handle crime type change
  const handleCrimeChange = (e) => {
    setSelectedCrime(e.target.value);
  };


// Draw the pie chart
useEffect(() => {
  if (data.length === 0) return; // Ensure data is loaded

  // Filter data based on the time range
  const filteredData = data.filter((d) => {
    const isInTimeRange =
      timeRange && d.date && d.date >= timeRange[0] && d.date <= timeRange[1];
    return isInTimeRange;
  });

  // Aggregate crime data by type
  const crimeCount = d3.rollups(filteredData, (v) => v.length, (d) => d.crimeType);

  // Prepare data for pie chart (format: {crimeType, count})
  const crimeDistributionData = crimeCount.map(([crimeType, count]) => ({
    crimeType,
    count,
  }));

  setCrimeDistribution(crimeDistributionData);
}, [data, timeRange]);

// Color scale for crime types
const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

// Draw the pie chart
useEffect(() => {
  if (crimeDistribution.length === 0) return; // No crime data to display

  const width = 400;
  const height = 400;
  const radius = Math.min(width, height) / 2;

  const svg = d3
    .select("#pieChart")
    .html("") // Clear previous chart
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  const pie = d3.pie().value((d) => d.count);

  const arc = d3.arc().outerRadius(radius - 10).innerRadius(0);

  const pieChartData = pie(crimeDistribution);

  svg
    .selectAll(".arc")
    .data(pieChartData)
    .enter()
    .append("g")
    .attr("class", "arc")
    .append("path")
    .attr("d", arc)
    .attr("fill", (d, i) => colorScale(i))
    .on("mouseover", (event, d) => {
      // Darken the color on hover
      const currentColor = d3.select(event.target).attr("fill");
      const darkenedColor = d3.color(currentColor).darker(1); // Darken by factor of 1 (adjust as needed)

      // Set the darkened color
      d3.select(event.target).attr("fill", darkenedColor);

      // Update selected crime type on mouseover
      setSelectedCrime(d.data.crimeType);
    })
    .on("mouseout", (event) => {
      // Reset the color to original on mouseout
      const currentColor = d3.select(event.target).attr("fill");
      const originalColor = d3.color(currentColor).brighter(1); // Lighten by factor of 1 (adjust as needed)

      // Set the original color
      d3.select(event.target).attr("fill", originalColor);

      // Reset to all crime types on mouseout
      setSelectedCrime("");
    });

  // Add text labels to the pie chart
  svg
    .selectAll(".arc")
    .append("text")
    .attr("transform", (d) => `translate(${arc.centroid(d)})`)
    .attr("dy", ".35em")
    .attr("text-anchor", "middle")
    .text((d) => {
      const percentage = (d.data.count / d3.sum(crimeDistribution.map((d) => d.count))) * 100;
      return percentage >= 3 ? d.data.crimeType : ''; // Only show label if > 3%
    })
    .style("fill", "#fff")
    .style("font-size", "12px");

}, [crimeDistribution]);






  // Handle time range change (slider)
  const handleTimeRangeChange = () => {
    const startDate = new Date(parseInt(document.getElementById("startDateSlider").value));
    const endDate = new Date(parseInt(document.getElementById("endDateSlider").value));

    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      // Ensure the start date is not after the end date
      if (startDate <= endDate) {
        setTimeRange([startDate, endDate]);
      } else {
        // If the start date is greater than the end date, swap them
        setTimeRange([endDate, startDate]);
      }
    }
  };

  // Handle time scale change (day or month)
  const handleTimeScaleChange = (e) => {
    setTimeScale(e.target.value);
  };

  return (
<div>
  <h1>Crime Data Visualization</h1>

  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px' }}>
    {/* Crime Cluster Map Section */}
    <div style={{ width: '48%' }}>
      <h2>Crime Cluster Map</h2>
      
    </div>
  </div>


      {/* Crime Type Dropdown */}
      <div>
        <label htmlFor="crimeType">Select Crime Type: </label>
        <select
          id="crimeType"
          onChange={handleCrimeChange}
          value={selectedCrime}
        >
          <option value="">All Crime Types</option>
          {crimeTypes.map((crime, index) => (
            <option key={index} value={crime}>
              {crime}
            </option>
          ))}
        </select>
      </div>

      {/* Time Range Slider */}
      <div>
        <label htmlFor="timeRange">Select Time Range: </label>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <input
            id="startDateSlider"
            type="range"
            min={new Date(2015, 0, 1).getTime()}
            max={new Date(2015, 11, 31).getTime()}
            step={86400000} // Step is one day (in milliseconds)
            value={timeRange[0].getTime()}
            onInput={handleTimeRangeChange}
          />
          <input
            id="endDateSlider"
            type="range"
            min={new Date(2015, 0, 1).getTime()}
            max={new Date(2015, 11, 31).getTime()}
            step={86400000} // Step is one day (in milliseconds)
            value={timeRange[1].getTime()}
            onInput={handleTimeRangeChange}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{timeRange[0].toISOString().split('T')[0]}</span>
          <span>{timeRange[1].toISOString().split('T')[0]}</span>
        </div>
      </div>

      {/* Time Scale Dropdown */}
      <div>
        <label htmlFor="timeScale">Select Time Scale: </label>
        <select
          id="timeScale"
          onChange={handleTimeScaleChange}
          value={timeScale}
        >
          <option value="day">Day</option>
          <option value="month">Month</option>
        </select>
      </div>

      <div
  style={{
    display: 'flex',
    flexDirection: 'row', // Arrange in a row (side by side)
    justifyContent: 'space-between', // Space out the items
    padding: '20px',
    height: '100vh', // Ensure they take up the full height of the viewport
  }}
>
  {/* Chart Container */}
  <div
    id="chart"
    style={{
      width: '48%', // Adjust width to fit side by side with the map
      height: '700px', // You can adjust the height as needed
      border: '1px solid #ccc',
      borderRadius: '8px',
      overflow: 'hidden',
    }}
  >
    {/* Your chart rendering logic goes here */}
  </div>

  {/* Map Container */}
  <div
    style={{
      width: '48%', // Adjust width to fit side by side with the chart
      height: '700px',
      margin: '0 auto',
      border: '1px solid #ccc',
      borderRadius: '8px',
      overflow: 'hidden',
    }}
  >
    <MapContainer
      center={[30.2672, -97.7431]} // Default center
      zoom={12}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {crimeData.map((cluster, index) => (
        <CircleMarker
          key={index}
          center={[cluster.lat, cluster.lng]}
          radius={Math.min(cluster.count * 2, 20)} // Adjust size based on cluster count
          fillOpacity={0.6}
          color="blue"
          fillColor="blue"
        >
          <Popup>
            <strong>Cluster Info</strong>
            <br />
            Crimes: {cluster.count}
            <br />
            Location: {cluster.lat.toFixed(4)}, {cluster.lng.toFixed(4)}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  </div>
</div>

        
    {/* Pie Chart */}
    <div id="pieChart"></div>

{/* Color Key */}
<div style={{ marginTop: "20px" }}>
  <h3>Crime Type Color Key:</h3>
  <div>
    {crimeDistribution.map((crime, index) => (
      <div key={index} style={{ marginBottom: "5px" }}>
        <span
          style={{
            display: "inline-block",
            width: "20px",
            height: "20px",
            backgroundColor: colorScale(index),
            marginRight: "10px",
          }}
        ></span>
        <span>{crime.crimeType}</span>
      </div>
    ))}
  </div>
</div>

    </div>

    
  );
};

export default CrimeDataChart;
