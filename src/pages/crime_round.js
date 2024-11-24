import React, { useEffect, useState } from "react";
import * as d3 from "d3";

const CrimeDataChart = () => {
  const [data, setData] = useState([]);
  const [timeRange, setTimeRange] = useState([new Date(2015, 0, 1), new Date(2015, 11, 31)]); // Default time range
  const [crimeDistribution, setCrimeDistribution] = useState([]); // To store aggregated crime data

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

      setData(processedData);
    });
  }, []);

  // Draw the pie chart
  useEffect(() => {
    if (data.length === 0) return; // Ensure data is loaded

    // Filter data based on the time range
    const filteredData = data.filter((d) => {
      const isInTimeRange =
        timeRange &&
        d.date &&
        d.date >= timeRange[0] &&
        d.date <= timeRange[1];
      return isInTimeRange;
    });

    // Aggregate crime data by type
    const crimeCount = d3.rollups(
      filteredData,
      (v) => v.length,
      (d) => d.crimeType
    );

    // Prepare data for pie chart (format: {crimeType, count})
    const crimeDistributionData = crimeCount.map(([crimeType, count]) => ({
      crimeType,
      count,
    }));

    setCrimeDistribution(crimeDistributionData);
  }, [data, timeRange]);

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
      .attr("fill", (d, i) => colorScale(i));

    // Add text labels to the pie chart
    svg
      .selectAll(".arc")
      .append("text")
      .attr("transform", (d) => `translate(${arc.centroid(d)})`)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .text((d) => d.data.crimeType)
      .style("fill", "#fff")
      .style("font-size", "12px");

  }, [crimeDistribution]);

  return (
    <div>
      <h1>Crime Data Visualization</h1>

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
