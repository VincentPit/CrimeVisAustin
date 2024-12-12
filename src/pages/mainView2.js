// mainView2.js 
import React, { useEffect, useState } from "react";
import * as d3 from "d3";
import dynamic from 'next/dynamic';
import { Spinner, Container, Row, Col, Card, Form, Navbar, Nav, Button } from 'react-bootstrap';
import { FaShieldAlt, FaFilter, FaCalendarAlt } from 'react-icons/fa';
import { AiOutlineCheck } from 'react-icons/ai';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then(mod => mod.CircleMarker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(mod => mod.Popup), { ssr: false });

const CrimeDataChart = () => {
  const [data, setData] = useState([]);
  const [selectedCrime, setSelectedCrime] = useState("");
  const [timeRange, setTimeRange] = useState([new Date(2015, 0, 1), new Date(2015, 11, 31)]);
  const [mainTimeRange, setMainTimeRange] = useState([new Date(2015, 0, 1), new Date(2015, 11, 31)]);
  const [initialTimeRange, setInitialTimeRange] = useState([new Date(2015, 0, 1), new Date(2015, 11, 31)]);
  const [crimeTypes, setCrimeTypes] = useState([]);
  const [crimeDistribution, setCrimeDistribution] = useState([]);
  const [crimeData, setCrimeData] = useState([]);
  const [timeScale, setTimeScale] = useState("day");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parseDate = d3.timeParse("%d-%b-%y");
    d3.csv("dataset/Annual_Crime_Dataset_2015withLongLad.csv").then(rawData => {
      const processedData = rawData
        .filter(d => d["GO Report Date"] && d["GO Highest Offense Desc"])
        .map(d => ({
          date: parseDate(d["GO Report Date"].trim()),
          lat: parseFloat(d.Latitude),
          lng: parseFloat(d.Longitude),
          crimeType: d["GO Highest Offense Desc"].trim(),
        }));

      const uniqueCrimeTypes = Array.from(new Set(processedData.map(d => d.crimeType)));

      setData(processedData);
      setCrimeTypes(uniqueCrimeTypes);
      const fullTimeRange = d3.extent(processedData, d => d.date);
      setMainTimeRange(fullTimeRange);
      setInitialTimeRange(fullTimeRange);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (data.length === 0) return;

    const filteredData = data.filter(d => !isNaN(d.lat) && !isNaN(d.lng)).filter(d => {
      const inRange = d.date >= timeRange[0] && d.date <= timeRange[1];
      const crimeMatch = selectedCrime ? d.crimeType === selectedCrime.trim() : true;
      return inRange && crimeMatch;
    });

    const clusterRadius = 0.05;
    const clusters = [];

    filteredData.forEach(crime => {
      const cluster = clusters.find(c => Math.abs(c.lat - crime.lat) <= clusterRadius && Math.abs(c.lng - crime.lng) <= clusterRadius);
      if (cluster) {
        cluster.count += 1;
      } else {
        clusters.push({ lat: crime.lat, lng: crime.lng, count: 1 });
      }
    });

    setCrimeData(clusters);

    const aggregatedData = timeScale === "day"
      ? d3.rollups(filteredData, v => v.length, d => d3.timeDay.floor(d.date)).map(([key, value]) => ({ date: key, count: value }))
      : d3.rollups(filteredData, v => v.length, d => d3.timeMonth.floor(d.date)).map(([key, value]) => ({ date: key, count: value }));

    d3.select("#mainChart").selectAll("*").remove();
    d3.select("#detailedChart").selectAll("*").remove();

    // 使用原始比例
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = 1200 - margin.left - margin.right; 
    const height = 300 - margin.top - margin.bottom;

    const mainSvg = d3.select("#mainChart")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const detailedSvg = d3.select("#detailedChart")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xMain = d3.scaleTime().domain(mainTimeRange).range([0, width * 0.55]);
    const yMain = d3.scaleLinear().domain([0, d3.max(aggregatedData, d => d.count) || 1]).nice().range([height, 0]);

    const xDetailed = d3.scaleTime().domain(timeRange).range([0, width * 0.55]);
    const yDetailed = d3.scaleLinear().domain([0, d3.max(aggregatedData, d => d.count) || 1]).nice().range([height, 0]);

    mainSvg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xMain).ticks(timeScale === "day" ? 10 : 6));

    mainSvg.append("g")
      .call(d3.axisLeft(yMain).ticks(15).tickFormat(d3.format("d")));

    detailedSvg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xDetailed).ticks(timeScale === "day" ? 10 : 6));

    detailedSvg.append("g")
      .call(d3.axisLeft(yDetailed).ticks(15).tickFormat(d3.format("d")));

    const line = d3.line().x(d => xMain(d.date)).y(d => yMain(d.count));
    const detailedLine = d3.line().x(d => xDetailed(d.date)).y(d => yDetailed(d.count));

    mainSvg.append("path")
      .data([aggregatedData])
      .attr("class", "line")
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "lightsteelblue")
      .attr("stroke-width", 2);

    detailedSvg.append("path")
      .data([aggregatedData.filter(d => d.date >= timeRange[0] && d.date <= timeRange[1])])
      .attr("class", "line")
      .attr("d", detailedLine)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2);

    const brush = d3.brushX().extent([[0, 0], [width, height]]).on("brush end", brushed);
    mainSvg.append("g").attr("class", "brush").call(brush);

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
      setMainTimeRange(initialTimeRange);
    }

    detailedSvg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xDetailed));

  }, [data, selectedCrime, timeRange, timeScale, mainTimeRange, initialTimeRange]);

  useEffect(() => {
    if (data.length === 0) return;

    const filteredData = data.filter(d => {
      const isInTimeRange = d.date && d.date >= timeRange[0] && d.date <= timeRange[1];
      return isInTimeRange;
    });

    const crimeCount = d3.rollups(filteredData, v => v.length, d => d.crimeType);
    const sortedCrimeTypes = crimeCount.sort((a, b) => b[1] - a[1]);
    const crimeDistributionData = sortedCrimeTypes.map(([crimeType, count]) => ({ crimeType, count }));

    setCrimeDistribution(crimeDistributionData);
  }, [data, timeRange]);

  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  useEffect(() => {
    if (crimeDistribution.length === 0) return;

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 150, left: 40 };

    const svg = d3.select("#barChart").html("").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .style("display","block")
      .style("margin","0 auto")
      .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    svg.append("rect")
      .attr("x",-margin.left)
      .attr("y",-margin.top)
      .attr("width",width+margin.left+margin.right)
      .attr("height",height+margin.top+margin.bottom)
      .attr("fill","#f9f9f9");

    const x = d3.scaleBand().domain(crimeDistribution.map(d => d.crimeType)).range([0, width]).padding(0.1);
    const y = d3.scaleLinear().domain([0, d3.max(crimeDistribution, d => d.count)]).nice().range([height, 0]);

    svg.append("g").selectAll(".bar")
      .data(crimeDistribution)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.crimeType))
      .attr("y", d => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(d.count))
      .attr("fill", (d, i) => colorScale(i))
      .style("stroke","#333")
      .style("stroke-width","0.5px")
      .on("mouseover", (event, d) => {
        const currentColor = d3.select(event.target).attr("fill");
        const darkenedColor = d3.color(currentColor).darker(1);
        d3.select(event.target).attr("fill", darkenedColor);
        setSelectedCrime(d.crimeType);
      })
      .on("mouseout", (event) => {
        const currentColor = d3.select(event.target).attr("fill");
        const originalColor = d3.color(currentColor).brighter(1);
        d3.select(event.target).attr("fill", originalColor);
        setSelectedCrime("");
      });

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x))
      .selectAll("text").attr("transform", "rotate(-45)").style("text-anchor", "end");

    svg.append("g").call(d3.axisLeft(y));

  }, [crimeDistribution]);

  const handleCrimeChange = (e) => {
    setSelectedCrime(e.target.value);
  };

  const handleTimeScaleChange = (e) => {
    setTimeScale(e.target.value);
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  // 统一卡片背景透明度为 rgba(255,255,255,0.7)
  const cardStyle = { backgroundColor: 'rgba(255,255,255,0.7)', border:'1px solid #ccc' };

  return (
    <div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700&family=Roboto&display=swap');
        body {
          font-family: 'Roboto', sans-serif;
          background: url('/background.jpg') no-repeat center center fixed;
          background-size: cover;
          color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Montserrat', sans-serif;
          font-weight:700;
        }
        .card-title {
          display: flex;
          align-items: center;
        }
        .card-title svg {
          margin-right: 8px;
          color: #007bff;
        }
        .navbar-brand {
          display: flex;
          align-items: center;
        }
        .navbar-brand svg {
          margin-right: 8px;
          color: #007bff;
        }
      `}</style>

      {/* 导航栏 */}
      <Navbar bg="light" expand="lg" className="mb-4 shadow-sm" style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}>
        <Container>
          <Navbar.Brand href="#">
            <FaShieldAlt style={{ marginRight: '8px' }} />
            Crime Data Dashboard
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container fluid style={{ padding: '20px' }}>
        {/* 标题 */}
        <Row className="mb-4">
          <Col className="text-center">
            <h1 style={{fontSize:'48px', color:'#000000'}}>
              <FaShieldAlt style={{ marginRight: '10px'}} />
              Crime Data Visualization
            </h1>
          </Col>
        </Row>

        {/* Info: 简约介绍，不使用大标题 */}
        <Row className="justify-content-center mb-4">
          <Col xs={12} md={6}>
            <Card className="shadow-sm" style={cardStyle}>
              <Card.Body>
                <Card.Text style={{fontSize:'16px'}}>
                  This tool helps you visualize and analyze Texas crime data over a selected period, enabling informed insights.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* 控制面板 + Apply 按钮 */}
        <Row className="mb-4 justify-content-center" style={{gap:'10px'}}>
          <Col xs={12} md={4}>
            <Form.Group controlId="crimeType">
              <Form.Label className="fw-bold">
                <FaFilter style={{ marginRight: '5px' }} />
                Select Crime Type
              </Form.Label>
              <Form.Control as="select" value={selectedCrime} onChange={handleCrimeChange}>
                <option value="">All Crime Types</option>
                {crimeTypes.map((crime, index) => (
                  <option key={index} value={crime}>{crime}</option>
                ))}
              </Form.Control>
            </Form.Group>
          </Col>
          <Col xs={12} md={4}>
            <Form.Group controlId="timeScale">
              <Form.Label className="fw-bold">
                <FaCalendarAlt style={{ marginRight: '5px' }} />
                Select Time Scale
              </Form.Label>
              <Form.Control as="select" value={timeScale} onChange={handleTimeScaleChange}>
                <option value="day">Day</option>
                <option value="month">Month</option>
              </Form.Control>
            </Form.Group>
          </Col>
          
        </Row>

        {/* 主体内容区：图表与地图 */}
        <Row className="mb-4">
          <Col xs={12} md={6} className="mb-4">
            <Card className="h-100 shadow-sm" style={{...cardStyle, background:'rgba(255,255,255,0.7)'}}>
              <Card.Body>
                <Card.Title>
                  <FaFilter style={{ marginRight: '8px' }} />
                  Crime Trends
                </Card.Title>
                <div id="chart" style={{ width: '100%', height: '700px', background:'rgba(255,255,255,0.8)', borderRadius:'5px', padding:'10px', border:'1px solid #ccc'}}>
                  <div id="mainChart" style={{ width: '100%', height: '50%' }}></div>
                  <div id="detailedChart" style={{ width: '100%', height: '50%' }}></div>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={12} md={6} className="mb-4">
            <Card className="h-100 shadow-sm" style={cardStyle}>
              <Card.Body>
                <Card.Title>
                  <FaShieldAlt style={{ marginRight: '8px' }} />
                  Crime Cluster Map
                </Card.Title>
                <MapContainer center={[30.2672, -97.7431]} zoom={10} style={{ height: "700px", width: "100%" }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  {crimeData.map((crime, index) => (
                    <CircleMarker
                      key={index}
                      center={[crime.lat, crime.lng]}
                      radius={Math.sqrt(crime.count) * 0.8}
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
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* 条形图区域 */}
        <Row className="mb-4">
          <Col>
            <Card className="shadow-sm" style={cardStyle}>
              <Card.Body>
                <Card.Title>
                  <FaFilter style={{ marginRight: '8px' }} />
                  Crime Types Distribution
                </Card.Title>
                <div id="barChart" style={{ width: '100%', height: '800px' }}></div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* 页脚 */}
        <Row>
          <Col className="text-center">
            <hr />
            <p style={{color:'#fff', textShadow:'1px 1px 2px rgba(0,0,0,0.5)'}}>&copy; {new Date().getFullYear()} DATS-SHU-235 Austin Crime Visualization.</p>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default CrimeDataChart;
