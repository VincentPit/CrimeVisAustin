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
  const [mainTimeRange, setMainTimeRange] = useState([new Date(2015, 0, 1), new Date(2015, 11, 31)]); // Time range for mainSvg
  const [initialTimeRange, setInitialTimeRange] = useState([new Date(2015, 0, 1), new Date(2015, 11, 31)]); // Initial full time range
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
      const fullTimeRange = d3.extent(processedData, (d) => d.date);
      setMainTimeRange(fullTimeRange); // Set main time range to full data range
      setInitialTimeRange(fullTimeRange); // Set initial full time range
    });
  }, []);

  // Draw the charts
  useEffect(() => {
    if (data.length === 0) return; // Ensure data is loaded
  
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
  
    // Remove any existing chart elements before redrawing
    d3.select("#mainChart").selectAll("*").remove();
    d3.select("#detailedChart").selectAll("*").remove();
  
    // Set chart dimensions
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = 1200 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom; // Adjust height for each view
  
    // Create SVG containers
    const mainSvg = d3
      .select("#mainChart")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
    const detailedSvg = d3
      .select("#detailedChart")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
    // Define scales
    const xMain = d3
      .scaleTime()
      .domain(mainTimeRange) // Use full data for main view
      .range([0, width*0.55]);
  
    const yMain = d3
      .scaleLinear()
      .domain([0, d3.max(aggregatedData, (d) => d.count) || 1]) // Avoid zero max
      .nice()
      .range([height, 0]);
  
    const xDetailed = d3
      .scaleTime()
      .domain(timeRange)
      .range([0, width*0.55]);
  
    const yDetailed = d3
      .scaleLinear()
      .domain([0, d3.max(aggregatedData, (d) => d.count) || 1]) // Avoid zero max
      .nice()
      .range([height, 0]);
  
    // Add X-axis to main view
    mainSvg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xMain).ticks(timeScale === "day" ? 10 : 6));
  
    // Add Y-axis to main view
    mainSvg
      .append("g")
      .call(
        d3.axisLeft(yMain)
          .ticks(15) // Increase the number of ticks for a more spread out axis
          .tickFormat(d3.format("d")) // Format ticks as integers
      );
  
    // Add X-axis to detailed view
    detailedSvg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xDetailed).ticks(timeScale === "day" ? 10 : 6));
  
    // Add Y-axis to detailed view
    detailedSvg
      .append("g")
      .call(
        d3.axisLeft(yDetailed)
          .ticks(15) // Increase the number of ticks for a more spread out axis
          .tickFormat(d3.format("d")) // Format ticks as integers
      );
  
    // Create line function
    const line = d3.line()
      .x((d) => xMain(d.date))
      .y((d) => yMain(d.count));
  
    const detailedLine = d3.line()
      .x((d) => xDetailed(d.date))
      .y((d) => yDetailed(d.count));
  
    // Add line to main view
    mainSvg
      .append("path")
      .data([aggregatedData]) // Wrap data in an array
      .attr("class", "line")
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "lightsteelblue")
      .attr("stroke-width", 2);
  
    // Add line to detailed view
    detailedSvg
      .append("path")
      .data([aggregatedData.filter(d => d.date >= timeRange[0] && d.date <= timeRange[1])]) // Filter data for detailed view
      .attr("class", "line")
      .attr("d", detailedLine)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2);
  
    // Define brush function
    const brush = d3.brushX()
      .extent([[0, 0], [width, height]])
      .on("end", brushed);

    // Add brush to main view
    mainSvg.append("g")
      .attr("class", "brush")
      .call(brush);

    // Brush event handler
    function brushed(event) {
      if (!event.selection) return;

      const [x0, x1] = event.selection.map(xMain.invert);
      xDetailed.domain([x0, x1]);

      detailedSvg.selectAll("path.line")
        .data([aggregatedData.filter(d => d.date >= x0 && d.date <= x1)])
        .attr("d", detailedLine);

      detailedSvg.select(".x-axis")
        .call(d3.axisBottom(xDetailed));

      setTimeRange([x0, x1]);
      setMainTimeRange(initialTimeRange); // Set main time range to full data range
} 

    // Add x-axis to detailed view
    detailedSvg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xDetailed));

  }, [data, selectedCrime, timeRange, timeScale, mainTimeRange]);

  // Handle crime type change
  const handleCrimeChange = (e) => {
    setSelectedCrime(e.target.value);
  };

  // Draw the bar chart
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

    // Sort crime types in descending order
    const sortedCrimeTypes = crimeCount.sort((a, b) => b[1] - a[1]);

    // Prepare data for bar chart (format: {crimeType, count})
    const crimeDistributionData = sortedCrimeTypes.map(([crimeType, count]) => ({
      crimeType,
      count,
    }));

    setCrimeDistribution(crimeDistributionData);
  }, [data, timeRange]);

  // Color scale for crime types
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Draw the bar chart
  useEffect(() => {
    if (crimeDistribution.length === 0) return; // No crime data to display

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 150, left: 40 };

    const svg = d3
      .select("#barChart")
      .html("") // Clear previous chart
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(crimeDistribution.map((d) => d.crimeType))
      .range([0, width])
      .padding(0.1);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(crimeDistribution, (d) => d.count)])
      .nice()
      .range([height, 0]);

    svg
      .append("g")
      .selectAll(".bar")
      .data(crimeDistribution)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.crimeType))
      .attr("y", (d) => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", (d) => height - y(d.count))
      .attr("fill", (d, i) => colorScale(i))
      .on("mouseover", (event, d) => {
        // Darken the color on hover
        const currentColor = d3.select(event.target).attr("fill");
        const darkenedColor = d3.color(currentColor).darker(1); // Darken by factor of 1 (adjust as needed)

        // Set the darkened color
        d3.select(event.target).attr("fill", darkenedColor);

        // Update selected crime type on mouseover
        setSelectedCrime(d.crimeType);
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

    // Add X-axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    // Add Y-axis
    svg.append("g").call(d3.axisLeft(y));

    // Add chart title
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .attr("font-size", "20px")
      .attr("font-weight", "bold")
      .text("Crime Types Distribution");
  }, [crimeDistribution]);

  // Handle time scale change (day or month)
  const handleTimeScaleChange = (e) => {
    setTimeScale(e.target.value);
  };

  return (
    <div style={{ height: '100vh', overflow: 'auto' }}>
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
  
      
        {/* Outer Container */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between', // Ensure space between the two containers
            width: '100%',
            height: '700px',
          }}
        >
          {/* Chart Container */}
          <div
            id="chart"
            style={{
              width: '48%',
              height: '700px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <div id="mainChart" style={{ width: '100%', height: '50%' }}></div>
            <div id="detailedChart" style={{ width: '100%', height: '50%' }}></div>
          </div>

          {/* Map Container */}
          <div
            style={{
              width: '48%', 
              height: '700px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              overflow: 'hidden',
              marginLeft: 'auto', // Align to the right
            }}
          >
            <MapContainer center={[30.2672, -97.7431]} zoom={10} style={{ height: "700px", width: "100%" }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {crimeData.map((crime, index) => (
                <CircleMarker
                  key={index}
                  center={[crime.lat, crime.lng]}
                  radius={Math.sqrt(crime.count)*0.8}
                  fillOpacity={0.5}
                  color="red"
                >
                  <Popup>
                    <div>
                      <strong>Crime Count:</strong> {crime.count}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
        </div>
      
      </div>
      {/* Bar Chart */}
      <div id="barChart" style={{ width: '100%', height: '800px', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}></div>
    </div>
  );
}

export default CrimeDataChart;