// mainView2.js
import React, { useEffect, useState } from "react";
import * as d3 from "d3";
import dynamic from 'next/dynamic';
import { Spinner, Container, Row, Col, Card, Form, Navbar, Nav } from 'react-bootstrap';
import { FaShieldAlt, FaFilter, FaCalendarAlt } from 'react-icons/fa'; // 引入多个图标
import 'bootstrap/dist/css/bootstrap.min.css';
import 'leaflet/dist/leaflet.css'; // Leaflet 默认样式

// 动态导入 react-leaflet 组件
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

  // 加载和处理 CSV 数据
  useEffect(() => {
    const parseDate = d3.timeParse("%d-%b-%y"); // 例如 "1-Jan-15" 格式
    d3.csv("dataset/Annual_Crime_Dataset_2015withLongLad.csv").then(rawData => {
      const processedData = rawData
        .filter(d => d["GO Report Date"] && d["GO Highest Offense Desc"]) // 过滤有效行
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

  // 绘制图表
  useEffect(() => {
    if (data.length === 0) return;

    // 根据 selectedCrime 和 timeRange 过滤数据
    const filteredData = data.filter(d => !isNaN(d.lat) && !isNaN(d.lng)).filter(d => {
      const isInTimeRange = timeRange && d.date && d.date >= timeRange[0] && d.date <= timeRange[1];
      const matchesCrime = selectedCrime ? d.crimeType === selectedCrime.trim() : true;
      return isInTimeRange && matchesCrime;
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

    // 根据选择的时间刻度（日或月）聚合数据
    const aggregatedData = timeScale === "day"
      ? d3.rollups(filteredData, v => v.length, d => d3.timeDay.floor(d.date)).map(([key, value]) => ({ date: key, count: value }))
      : d3.rollups(filteredData, v => v.length, d => d3.timeMonth.floor(d.date)).map(([key, value]) => ({ date: key, count: value }));

    // 清除之前的图表元素
    d3.select("#mainChart").selectAll("*").remove();
    d3.select("#detailedChart").selectAll("*").remove();

    // 设置图表尺寸
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = 800 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    // 创建 SVG 容器
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

    // 定义比例尺
    const xMain = d3.scaleTime().domain(mainTimeRange).range([0, width * 0.55]);
    const yMain = d3.scaleLinear().domain([0, d3.max(aggregatedData, d => d.count) || 1]).nice().range([height, 0]);

    const xDetailed = d3.scaleTime().domain(timeRange).range([0, width * 0.55]);
    const yDetailed = d3.scaleLinear().domain([0, d3.max(aggregatedData, d => d.count) || 1]).nice().range([height, 0]);

    // 添加主视图的 X 轴
    mainSvg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xMain).ticks(timeScale === "day" ? 10 : 6));

    // 添加主视图的 Y 轴
    mainSvg.append("g")
      .call(d3.axisLeft(yMain).ticks(15).tickFormat(d3.format("d")));

    // 添加详细视图的 X 轴
    detailedSvg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xDetailed).ticks(timeScale === "day" ? 10 : 6));

    // 添加详细视图的 Y 轴
    detailedSvg.append("g")
      .call(d3.axisLeft(yDetailed).ticks(15).tickFormat(d3.format("d")));

    // 创建折线函数
    const line = d3.line().x(d => xMain(d.date)).y(d => yMain(d.count));
    const detailedLine = d3.line().x(d => xDetailed(d.date)).y(d => yDetailed(d.count));

    // 添加主视图的折线
    mainSvg.append("path")
      .data([aggregatedData])
      .attr("class", "line")
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "lightsteelblue")
      .attr("stroke-width", 2);

    // 添加详细视图的折线
    detailedSvg.append("path")
      .data([aggregatedData.filter(d => d.date >= timeRange[0] && d.date <= timeRange[1])])
      .attr("class", "line")
      .attr("d", detailedLine)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 2);

    // 定义刷子功能
    const brush = d3.brushX().extent([[0, 0], [width, height]]).on("brush end", brushed);

    // 将刷子添加到主视图
    mainSvg.append("g").attr("class", "brush").call(brush);

    // 刷子事件处理器
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

    // 为详细视图添加 X 轴
    detailedSvg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xDetailed));

  }, [data, selectedCrime, timeRange, timeScale, mainTimeRange, initialTimeRange]);

  // 处理选择的犯罪类型
  const handleCrimeChange = (e) => {
    setSelectedCrime(e.target.value);
  };

  // 绘制条形图
  useEffect(() => {
    if (data.length === 0) return;

    const filteredData = data.filter(d => {
      const isInTimeRange = timeRange && d.date && d.date >= timeRange[0] && d.date <= timeRange[1];
      return isInTimeRange;
    });

    const crimeCount = d3.rollups(filteredData, v => v.length, d => d.crimeType);
    const sortedCrimeTypes = crimeCount.sort((a, b) => b[1] - a[1]);
    const crimeDistributionData = sortedCrimeTypes.map(([crimeType, count]) => ({ crimeType, count }));

    setCrimeDistribution(crimeDistributionData);
  }, [data, timeRange]);

  // 颜色比例尺
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // 绘制条形图
  useEffect(() => {
    if (crimeDistribution.length === 0) return;

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 150, left: 40 };

    const svg = d3.select("#barChart").html("").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

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
      .on("mouseover", (event, d) => {
        // 加深颜色
        const currentColor = d3.select(event.target).attr("fill");
        const darkenedColor = d3.color(currentColor).darker(1);
        d3.select(event.target).attr("fill", darkenedColor);
        setSelectedCrime(d.crimeType);
      })
      .on("mouseout", (event) => {
        // 重置颜色
        const currentColor = d3.select(event.target).attr("fill");
        const originalColor = d3.color(currentColor).brighter(1);
        d3.select(event.target).attr("fill", originalColor);
        setSelectedCrime("");
      });

    // 添加 X 轴
    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x))
      .selectAll("text").attr("transform", "rotate(-45)").style("text-anchor", "end");

    // 添加 Y 轴
    svg.append("g").call(d3.axisLeft(y));

    // 添加图表标题
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("font-size", "20px")
      .attr("font-weight", "bold")
      .text("Crime Types Distribution");
  }, [crimeDistribution]);

  // 处理时间刻度变化
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

  return (
    <div>
      {/* 内联样式 */}
      <style>{`
        body {
          font-family: 'Roboto', sans-serif;
          background: linear-gradient(135deg, #f5f7fa, #c3cfe2);
          color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Montserrat', sans-serif;
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
      <Navbar bg="light" expand="lg" className="mb-4 shadow-sm">
        <Container>
          <Navbar.Brand href="#">
            <FaShieldAlt style={{ marginRight: '8px' }} />
            Crime Data Dashboard
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto">
              <Nav.Link href="#">Home</Nav.Link>
              <Nav.Link href="#">About</Nav.Link>
              <Nav.Link href="#">Contact</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container fluid style={{ padding: '20px' }}>
        {/* 标题 */}
        <Row className="mb-4">
          <Col className="text-center">
            <h1>
              <FaShieldAlt style={{ marginRight: '10px', color: '#007bff' }} />
              Crime Data Visualization
            </h1>
          </Col>
        </Row>

        {/* 控制面板 */}
        <Row className="mb-4 justify-content-center">
          <Col xs={12} md={4} className="mb-2">
            <Form.Group controlId="crimeType">
              <Form.Label>
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
          <Col xs={12} md={4} className="mb-2">
            <Form.Group controlId="timeScale">
              <Form.Label>
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
            <Card className="h-100 shadow-sm">
              <Card.Body>
                <Card.Title>
                  <FaFilter style={{ marginRight: '8px' }} />
                  Crime Trends
                </Card.Title>
                <div id="chart" style={{ width: '100%', height: '700px' }}>
                  <div id="mainChart" style={{ width: '100%', height: '50%' }}></div>
                  <div id="detailedChart" style={{ width: '100%', height: '50%' }}></div>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={12} md={6} className="mb-4">
            <Card className="h-100 shadow-sm">
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
            <Card className="shadow-sm">
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
            <p>&copy; {new Date().getFullYear()} Crime Data Dashboard. All rights reserved.</p>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default CrimeDataChart;
