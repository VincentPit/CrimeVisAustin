import React, { useEffect, useState } from "react";
import * as d3 from "d3";

const CrimeDataChart = () => {
  const [data, setData] = useState([]);
  const [selectedCrime, setSelectedCrime] = useState("");
  const [timeRange, setTimeRange] = useState([new Date(2015, 0, 1), new Date(2015, 11, 31)]); // Default time range
  const [crimeTypes, setCrimeTypes] = useState([]);
  const [timeScale, setTimeScale] = useState("day"); // Default to day scale

  // Load and process the CSV data
  useEffect(() => {
    const parseDate = d3.timeParse("%d-%b-%y"); // Adjust to match "1-Jan-15" format
    d3.csv("dataset/Annual_Crime_Dataset_2015withLongLad.csv").then((rawData) => {
      const processedData = rawData
        .filter((d) => d["GO Report Date"] && d["GO Highest Offense Desc"]) // Filter valid rows
        .map((d) => ({
          date: parseDate(d["GO Report Date"].trim()),
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

    // Filter data based on selectedCrime and timeRange
    const filteredData = data.filter((d) => {
      const isInTimeRange =
        timeRange &&
        d.date &&
        d.date >= timeRange[0] &&
        d.date <= timeRange[1];
      const matchesCrime =
        selectedCrime && selectedCrime !== "" ? d.crimeType === selectedCrime.trim() : true; // Include all data when selectedCrime is empty
      return isInTimeRange && matchesCrime;
    });

    console.log("Filtered Data:", filteredData); // Debugging

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

    console.log("Aggregated Data:", aggregatedData); // Debugging

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

      {/* Chart Container */}
      <div id="chart"></div>
    </div>
  );
};

export default CrimeDataChart;
