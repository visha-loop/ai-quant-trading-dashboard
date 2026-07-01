import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Cpu, 
  Layers, 
  Compass, 
  DollarSign, 
  ShieldAlert, 
  ArrowRight,
  ChevronDown,
  LineChart,
  Brain,
  History,
  Boxes
} from 'lucide-react';
import Plotly from 'plotly.js-dist-min';
import ThreeCanvas from './components/ThreeCanvas';

const STOCKS = {
  "AAPL": { name: "Apple Inc. (AAPL)", color: "#00ffaa" },
  "TSLA": { name: "Tesla (TSLA)", color: "#00d8ff" },
  "MSFT": { name: "Microsoft (MSFT)", color: "#ffb700" },
  "AMZN": { name: "Amazon (AMZN)", color: "#ff7b00" },
  "NVDA": { name: "NVIDIA (NVDA)", color: "#a855f7" },
  "RELIANCE.NS": { name: "Reliance Industries (RELIANCE.NS)", color: "#3b82f6" },
  "INFY.NS": { name: "Infosys (INFY.NS)", color: "#ef4444" }
};

// Reusable Plotly Chart Component
function PlotlyChart({ data, layout, config, style }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (chartRef.current && data) {
      Plotly.newPlot(chartRef.current, data, layout, config || { responsive: true, displayModeBar: false });
    }
  }, [data, layout, config]);

  return <div ref={chartRef} style={style || { width: '100%', height: '100%' }} />;
}

export default function App() {
  const [selectedTicker, setSelectedTicker] = useState("AAPL");
  const [interval, setInterval] = useState("1d");
  const [period, setPeriod] = useState("30d");
  const [chartMode, setChartMode] = useState("Full Analysis");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Data loading & error states
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Tab Management
  const [activeTab, setActiveTab] = useState("overview");
  // 3D Selector inside tab5
  const [selectedModel, setSelectedModel] = useState("Random Forest");
  const [threeVizMode, setThreeVizMode] = useState("3D Price-Volume-RSI Trajectory");
  
  
  // Backtest input controls
  const [backtestShort, setBacktestShort] = useState(12);
  const [backtestLong, setBacktestLong] = useState(20);
  const [backtestCapital, setBacktestCapital] = useState(10000);
  
  const [inputShort, setInputShort] = useState(12);
  const [inputLong, setInputLong] = useState(20);
  const [inputCapital, setInputCapital] = useState(10000);
  
  // Chat Co-Pilot States
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInputText, setChatInputText] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { sender: 'agent', text: "SYSTEM ACTIVE: Quant Co-Pilot is online.\n\nType your query to analyze the currently selected asset. For example:\n- 'explain signals'\n- 'predict target'\n- 'show performance'" }
  ]);
  
  const terminalRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;
    
    const userMsg = chatInputText.trim();
    const newMessages = [...chatMessages, { sender: 'user', text: userMsg }];
    setChatMessages(newMessages);
    setChatInputText("");
    
    setTimeout(() => {
      const agentReply = getAgentResponse(userMsg);
      setChatMessages(prev => [...prev, { sender: 'agent', text: agentReply }]);
    }, 500);
  };

  const getAgentResponse = (userQuery) => {
    if (!apiData) return "ERROR: TERMINAL DATA NOT INITIALIZED. PLEASE SELECT AN ASSET IN THE SIDEBAR AND LAUNCH HANDSHAKE.";
    
    const q = userQuery.toLowerCase();
    const ticker = apiData.ticker;
    const company = apiData.company.longName;
    const price = apiData.overview.price;
    const signal = apiData.overview.signal;
    const trend = apiData.overview.trend;
    const rsi = apiData.overview.rsi;
    
    if (q.includes("help") || q.includes("options") || q.includes("what can you") || q.includes("hi") || q.includes("hello")) {
      return `Welcome to the Quant Co-Pilot terminal. Active Asset: ${ticker} (${company})

I can answer questions regarding the active market matrix. Try typing:
- "what is the signal?" (Checks indicator consensus)
- "predict target" (Queries Random Forest ML model)
- "explain technicals" (RSI, MACD details)
- "backtest performance" (Crossover returns)`;
    }
    
    if (q.includes("signal") || q.includes("action") || q.includes("buy") || q.includes("sell") || q.includes("hold") || q.includes("should i")) {
      let advice = "";
      if (signal === "BUY") {
        advice = "INDICATOR CONVERGENCE: Buy signal triggered. EMA 12 is tracking above SMA 20, MACD momentum is positive, and RSI indicates non-overbought momentum.";
      } else if (signal === "SELL") {
        advice = "INDICATOR REGRESSION: Sell signal triggered. High risk of mean reversion. Indicators show overbought bounds or downward momentum crosses.";
      } else {
        advice = "NEUTRAL STATE: Hold position. Market is consolidating or crossover indicators show no clear trend alignment.";
      }
      return `CO-PILOT REASONING [${ticker}]:
Current consensus is [${signal}].

${advice}

Market Price: $${price.toFixed(2)}
RSI: ${rsi.toFixed(2)}
Momentum: ${trend}`;
    }
    
    if (q.includes("predict") || q.includes("tomorrow") || q.includes("next day") || q.includes("future") || q.includes("machine learning") || q.includes("ml")) {
      if (!apiData.ml.hasEnoughData) {
        return "MODEL ERROR: Local Random Forest classifier has insufficient clean historical rows. Try selecting a longer timeframe (e.g., 60d or 1y) in the dropdown to retrain.";
      }
      return `ML FORECAST MODEL [${ticker}]:
Day-Ahead Direction: [${apiData.ml.tomorrowPrediction}]
Model Confidence: ${apiData.ml.probability}%
Historical Accuracy: ${apiData.ml.accuracy}%

Top Feature Weights:
1. ${apiData.ml.featureImportance[0]?.feature}: ${(apiData.ml.featureImportance[0]?.importance*100).toFixed(1)}%
2. ${apiData.ml.featureImportance[1]?.feature}: ${(apiData.ml.featureImportance[1]?.importance*100).toFixed(1)}%`;
    }
    
    if (q.includes("backtest") || q.includes("performance") || q.includes("return") || q.includes("capital") || q.includes("drawdown") || q.includes("win rate")) {
      const b = apiData.backtest;
      return `BACKTEST PERFORMANCE SUMMARY [${ticker}]:
Initial capital: $${b.initialBalance.toLocaleString()}
Ending capital: $${b.finalBalance.toLocaleString()}
Net Returns: ${b.returnPercent >= 0 ? '+' : ''}${b.returnPercent}%
Max Drawdown: -${b.maxDrawdown}%

Trade Summary:
- Win Rate: ${b.winRate}% (${b.winningTrades} wins out of ${b.totalTrades} completed trades)
- Profit Factor: ${b.profitFactor}x`;
    }
    
    if (q.includes("technical") || q.includes("indicators") || q.includes("rsi") || q.includes("macd") || q.includes("bollinger") || q.includes("moving average")) {
      const lastRow = apiData.historical[apiData.historical.length - 1];
      const emaStatus = lastRow.ema_12 > lastRow.sma_20 ? "BULLISH (EMA > SMA)" : "BEARISH (EMA < SMA)";
      const rsiStatus = rsi > 70 ? "OVERBOUGHT" : rsi < 30 ? "OVERSOLD" : "NEUTRAL";
      
      return `TECHNICAL MATRIX STATUS [${ticker}]:
- RSI (14): ${rsi.toFixed(2)} [${rsiStatus}]
- MACD: ${apiData.overview.macd.toFixed(2)} (Signal: ${apiData.overview.macdSignal.toFixed(2)})
- Trend: ${trend}
- Structure: ${emaStatus}`;
    }
    
    if (q.includes("price") || q.includes("market") || q.includes("cap") || q.includes("value") || q.includes("cost")) {
      const change = apiData.overview.changePercent;
      return `ASSET DETAILS: ${company} (${ticker})
- Current Price: $${price.toFixed(2)}
- Daily Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%
- Sector: ${apiData.company.sector}
- Market Cap: $${typeof apiData.company.marketCap === 'number' ? apiData.company.marketCap.toLocaleString() : apiData.company.marketCap}`;
    }
    
    return `ANALYZING: ${company} (${ticker}) is trading at $${price.toFixed(2)} [${trend}].

I can run predictive calculations or parse technical details. Try asking:
- "is the trend bullish?"
- "what is tomorrow's prediction?"
- "how does the backtest look?"
- "show company details"`;
  };

  // Fetch data from FastAPI backend
  const fetchData = async (ticker, p, i, shortW = 12, longW = 20, capital = 10000) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/api/analyze?ticker=${ticker}&period=${p}&interval=${i}&short_window=${shortW}&long_window=${longW}&initial_capital=${capital}`);
      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        setApiData(result);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to FastAPI backend server. Verify it is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedTicker, period, interval, backtestShort, backtestLong, backtestCapital);
  }, [selectedTicker, period, interval, backtestShort, backtestLong, backtestCapital]);

  const handleAssetSelect = (ticker) => {
    setSelectedTicker(ticker);
    setDropdownOpen(false);
  };

  const handleScrollToTerminal = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleRunBacktest = () => {
    setBacktestShort(inputShort);
    setBacktestLong(inputLong);
    setBacktestCapital(inputCapital);
  };

  // Compute colors, values, and reasoning
  const themeColor = STOCKS[selectedTicker]?.color || '#00ffaa';
  
  // Technical Plotly config generators
  const getTechnicalsPlotData = () => {
    if (!apiData || !apiData.historical || apiData.historical.length === 0) return { data: [], layout: {} };
    
    const h = apiData.historical;
    const dates = h.map(x => x.date);
    const close = h.map(x => x.close);
    const open = h.map(x => x.open);
    const high = h.map(x => x.high);
    const low = h.map(x => x.low);
    const volume = h.map(x => x.volume);
    
    const sma20 = h.map(x => x.sma_20);
    const ema12 = h.map(x => x.ema_12);
    const bbHigh = h.map(x => x.bb_high);
    const bbLow = h.map(x => x.bb_low);
    const macdVal = h.map(x => x.macd);
    const macdSig = h.map(x => x.macd_signal);
    const macdHist = h.map(x => x.macd_hist);
    
    const volumeColors = h.map(x => (x.close >= x.open ? 'rgba(0, 255, 170, 0.4)' : 'rgba(239, 68, 68, 0.4)'));
    const histColors = macdHist.map(x => (x >= 0 ? 'rgba(0, 255, 170, 0.5)' : 'rgba(239, 68, 68, 0.5)'));

    let traces = [];
    let layout = {
      template: 'plotly_dark',
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'rgba(0,0,0,0.2)',
      xaxis: { gridcolor: 'rgba(255,255,255,0.05)', linecolor: 'rgba(255,255,255,0.1)' },
      yaxis: { gridcolor: 'rgba(255,255,255,0.05)', linecolor: 'rgba(255,255,255,0.1)', title: 'Price ($)' },
      margin: { l: 50, r: 20, t: 30, b: 50 },
      height: 550,
      showlegend: true,
      legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x: 1 }
    };

    if (chartMode === "Price Only") {
      traces.push({
        x: dates, open: open, high: high, low: low, close: close,
        type: 'candlestick', name: selectedTicker,
        increasing: { line: { color: '#00ffaa' } },
        decreasing: { line: { color: '#ef4444' } }
      });
      traces.push({ x: dates, y: sma20, mode: 'lines', name: 'SMA 20', line: { color: '#a855f7', width: 1.5 } });
      traces.push({ x: dates, y: ema12, mode: 'lines', name: 'EMA 12', line: { color: '#3b82f6', width: 1.5 } });
    } 
    else if (chartMode === "Price + Volume") {
      // Subplots: rows 1 and 2
      layout.grid = { rows: 2, columns: 1, pattern: 'coupled', roworder: 'top to bottom' };
      layout.subplots = [['xy'], ['xy2']];
      layout.yaxis.domain = [0.3, 1];
      layout.yaxis2 = { gridcolor: 'rgba(255,255,255,0.05)', title: 'Volume', domain: [0, 0.22] };
      layout.xaxis.anchor = 'y2';

      traces.push({
        x: dates, open: open, high: high, low: low, close: close,
        type: 'candlestick', name: selectedTicker, xaxis: 'x', yaxis: 'y',
        increasing: { line: { color: '#00ffaa' } },
        decreasing: { line: { color: '#ef4444' } }
      });
      traces.push({
        x: dates, y: volume, type: 'bar', name: 'Volume', xaxis: 'x', yaxis: 'y2',
        marker: { color: volumeColors }, showlegend: false
      });
    } 
    else if (chartMode === "Price + MACD") {
      layout.grid = { rows: 2, columns: 1, pattern: 'coupled' };
      layout.subplots = [['xy'], ['xy2']];
      layout.yaxis.domain = [0.35, 1];
      layout.yaxis2 = { gridcolor: 'rgba(255,255,255,0.05)', title: 'MACD', domain: [0, 0.28] };
      layout.xaxis.anchor = 'y2';

      traces.push({
        x: dates, open: open, high: high, low: low, close: close,
        type: 'candlestick', name: selectedTicker, xaxis: 'x', yaxis: 'y',
        increasing: { line: { color: '#00ffaa' } },
        decreasing: { line: { color: '#ef4444' } }
      });
      traces.push({ x: dates, y: macdVal, mode: 'lines', name: 'MACD', line: { color: '#3b82f6', width: 1.5 }, xaxis: 'x', yaxis: 'y2' });
      traces.push({ x: dates, y: macdSig, mode: 'lines', name: 'Signal', line: { color: '#f59e0b', width: 1.5 }, xaxis: 'x', yaxis: 'y2' });
      traces.push({
        x: dates, y: macdHist, type: 'bar', name: 'Histogram', xaxis: 'x', yaxis: 'y2',
        marker: { color: histColors }, showlegend: false
      });
    } 
    else { // Full Analysis
      layout.grid = { rows: 3, columns: 1, pattern: 'coupled' };
      layout.subplots = [['xy'], ['xy2'], ['xy3']];
      layout.yaxis.domain = [0.45, 1];
      layout.yaxis2 = { gridcolor: 'rgba(255,255,255,0.05)', title: 'Volume', domain: [0.26, 0.40] };
      layout.yaxis3 = { gridcolor: 'rgba(255,255,255,0.05)', title: 'MACD', domain: [0, 0.22] };
      layout.xaxis.anchor = 'y3';

      traces.push({
        x: dates, open: open, high: high, low: low, close: close,
        type: 'candlestick', name: selectedTicker, xaxis: 'x', yaxis: 'y',
        increasing: { line: { color: '#00ffaa' } },
        decreasing: { line: { color: '#ef4444' } }
      });
      traces.push({ x: dates, y: sma20, mode: 'lines', name: 'SMA 20', line: { color: '#a855f7', width: 1.2 }, xaxis: 'x', yaxis: 'y' });
      traces.push({ x: dates, y: bbHigh, mode: 'lines', name: 'BB Upper', line: { color: 'rgba(255,255,255,0.2)', dash: 'dash', width: 1 }, xaxis: 'x', yaxis: 'y' });
      traces.push({ x: dates, y: bbLow, mode: 'lines', name: 'BB Lower', line: { color: 'rgba(255,255,255,0.2)', dash: 'dash', width: 1 }, xaxis: 'x', yaxis: 'y' });
      
      traces.push({
        x: dates, y: volume, type: 'bar', name: 'Volume', xaxis: 'x', yaxis: 'y2',
        marker: { color: volumeColors }, showlegend: false
      });

      traces.push({ x: dates, y: macdVal, mode: 'lines', name: 'MACD', line: { color: '#3b82f6', width: 1.2 }, xaxis: 'x', yaxis: 'y3' });
      traces.push({ x: dates, y: macdSig, mode: 'lines', name: 'Signal', line: { color: '#f59e0b', width: 1.2 }, xaxis: 'x', yaxis: 'y3' });
      traces.push({
        x: dates, y: macdHist, type: 'bar', name: 'Histogram', xaxis: 'x', yaxis: 'y3',
        marker: { color: histColors }, showlegend: false
      });
    }

    // Hide rangeslider for candlestick
    layout.xaxis.rangeslider = { visible: false };
    if (layout.xaxis2) layout.xaxis2.rangeslider = { visible: false };
    if (layout.xaxis3) layout.xaxis3.rangeslider = { visible: false };

    return { data: traces, layout: layout };
  };

  const getEquityCurvePlotData = () => {
    if (!apiData || !apiData.backtest || !apiData.backtest.equityCurve) return { data: [], layout: {} };
    const ec = apiData.backtest.equityCurve;
    const dates = ec.map(x => x.date);
    const equity = ec.map(x => x.equity);
    
    return {
      data: [{
        x: dates,
        y: equity,
        mode: 'lines',
        line: { color: themeColor, width: 2.5 },
        fill: 'tozeroy',
        fillcolor: `${themeColor}0a`,
        name: 'Portfolio Equity'
      }],
      layout: {
        template: 'plotly_dark',
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'rgba(0,0,0,0.1)',
        xaxis: { gridcolor: 'rgba(255,255,255,0.03)', linecolor: 'rgba(255,255,255,0.1)' },
        yaxis: { gridcolor: 'rgba(255,255,255,0.03)', linecolor: 'rgba(255,255,255,0.1)', title: 'Equity ($)' },
        margin: { l: 60, r: 20, t: 15, b: 40 },
        height: 280
      }
    };
  };

  const getAccuracyComparisonPlotData = () => {
    if (!apiData || !apiData.ml || !apiData.ml.comparison) return { data: [], layout: {} };
    const comp = apiData.ml.comparison;
    const names = comp.map(x => x.modelName);
    const accs = comp.map(x => x.accuracy);
    
    return {
      data: [{
        x: names,
        y: accs,
        type: 'bar',
        marker: {
          color: [themeColor, '#a855f7', '#3b82f6'],
          opacity: 0.85
        },
        name: 'Test Accuracy'
      }],
      layout: {
        template: 'plotly_dark',
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'rgba(0,0,0,0.1)',
        xaxis: { gridcolor: 'rgba(255,255,255,0.03)', linecolor: 'rgba(255,255,255,0.1)' },
        yaxis: { gridcolor: 'rgba(255,255,255,0.03)', linecolor: 'rgba(255,255,255,0.1)', title: 'Accuracy (%)', range: [0, 100] },
        margin: { l: 50, r: 20, t: 15, b: 40 },
        height: 250
      }
    };
  };

  // 3D Plot generators
  const get3DPlotData = () => {
    if (!apiData || !apiData.historical || apiData.historical.length === 0) return { data: [], layout: {} };
    const h = apiData.historical;
    const dates = h.map(x => x.date);
    const close = h.map(x => x.close);
    const rsi = h.map(x => x.rsi);
    const macdHist = h.map(x => x.macd_hist || 0);

    let data = [];
    let layout = {
      template: 'plotly_dark',
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      margin: { l: 0, r: 0, t: 20, b: 0 },
      height: 600,
      scene: {
        xaxis: { title: 'Date', gridcolor: 'rgba(255,255,255,0.08)', backgroundcolor: 'black' },
        yaxis: { title: 'Close Price ($)', gridcolor: 'rgba(255,255,255,0.08)', backgroundcolor: 'black' },
        zaxis: { title: 'RSI (14)', gridcolor: 'rgba(255,255,255,0.08)', backgroundcolor: 'black' }
      }
    };

    if (threeVizMode === "3D Price-Volume-RSI Trajectory") {
      // Trace 1: Line path
      data.push({
        x: dates, y: close, z: rsi,
        type: 'scatter3d', mode: 'lines',
        line: { color: themeColor, width: 4 },
        name: 'Path'
      });
      // Trace 2: Scatter points
      data.push({
        x: dates, y: close, z: rsi,
        type: 'scatter3d', mode: 'markers',
        marker: {
          size: 5,
          color: macdHist,
          colorscale: 'RdYlGn',
          colorbar: { title: 'MACD Hist', x: -0.15 },
          opacity: 0.8
        },
        text: h.map(x => `Date: ${x.date}<br>Price: $${x.close.toFixed(2)}<br>RSI: ${x.rsi?.toFixed(1)}`),
        hoverinfo: 'text',
        name: 'Trading Days'
      });
    } 
    else if (threeVizMode === "3D ML Decision Space") {
      if (!apiData.mlPoints || apiData.mlPoints.length === 0) {
        return { error: "No Machine Learning feature space points calculated yet." };
      }
      
      const ml = apiData.mlPoints;
      data.push({
        x: ml.map(x => x.returns * 100),
        y: ml.map(x => x.volatility * 100),
        z: ml.map(x => x.rsi),
        type: 'scatter3d', mode: 'markers',
        marker: {
          size: 6,
          color: ml.map(x => x.target),
          colorscale: [[0, 'crimson'], [1, 'mediumseagreen']],
          colorbar: {
            title: 'Direction',
            tickvals: [0, 1],
            ticktext: ['DOWN', 'UP'],
            x: -0.15
          },
          opacity: 0.9
        },
        text: ml.map(x => `Date: ${x.date}<br>Return: ${(x.returns*100).toFixed(2)}%<br>Vol: ${(x.volatility*100).toFixed(2)}%<br>RSI: ${x.rsi?.toFixed(1)}`),
        hoverinfo: 'text',
        name: 'Trading Days'
      });
      layout.scene.xaxis.title = 'Daily Return (%)';
      layout.scene.yaxis.title = 'Volatility (%)';
    } 
    else if (threeVizMode === "3D Volatility Term Structure Surface") {
      const volWindows = [5, 10, 15, 20, 25, 30];
      
      // Make sure columns are calculated
      const firstRow = h[0];
      if (!firstRow || firstRow.vol_term_5 === undefined) {
        return { error: "Volatility term structure metrics unavailable. Try selecting a longer timeframe." };
      }

      // Matrix z_data has shape (len(volWindows), len(h))
      let zData = [];
      volWindows.forEach(w => {
        const rowVols = h.map(x => x[`vol_term_${w}`]);
        zData.push(rowVols);
      });

      data.push({
        x: dates,
        y: volWindows,
        z: zData,
        type: 'surface',
        colorscale: 'Plasma',
        colorbar: { title: 'Annualized Vol %', x: -0.15 }
      });
      layout.scene.yaxis.title = 'Lookback Window (Days)';
      layout.scene.zaxis.title = 'Volatility (%)';
    }

    return { data: data, layout: layout };
  };

  const getMarketHealthScore = () => {
    if (!apiData || !apiData.overview) return 50;
    const { rsi, macd, macdSignal, price } = apiData.overview;
    // Look up indicators computed on full data
    const lastRow = apiData.historical[apiData.historical.length - 1];
    if (!lastRow) return 50;
    
    const ema = lastRow.ema_12;
    const sma = lastRow.sma_20;
    
    let score = 0;
    score += (ema > sma ? 40 : 20);
    score += (macd > macdSignal ? 30 : 15);
    score += (rsi >= 40 && rsi <= 60 ? 30 : 15);
    return score;
  };

  return (
    <div className="app-container">
      {/* Background Grids */}
      <div className="tech-grid-bg" />
      <div className="glow-aura" style={{ background: `radial-gradient(circle, ${themeColor}0e 0%, #a855f705 50%, transparent 100%)` }} />

      {/* Navigation */}
      <header className="navbar">
        <div className="logo" onClick={handleScrollToTerminal}>
          <Boxes className="logo-glow" size={24} style={{ color: themeColor }} />
          <span>QUANT <span className="logo-glow" style={{ color: themeColor }}>AI</span></span>
        </div>
        <nav className="nav-links">
          <a href="#about" className="nav-link">Intelligence</a>
          <a href="#features" className="nav-link">Technicals</a>
          <a href="#ml" className="nav-link">AI Analytics</a>
          <a href="#backtest" className="nav-link">Backtests</a>
        </nav>
        <button className="nav-btn" onClick={handleScrollToTerminal} style={{ borderColor: themeColor, hover: { backgroundColor: themeColor } }}>
          Launch Terminal
        </button>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-tag" style={{ color: themeColor, borderColor: `${themeColor}40`, backgroundColor: `${themeColor}0c` }}>
            <Activity size={12} /> Live Market Quant Engine
          </div>
          <h1 className="hero-title">
            Decipher Market <span className="gradient-text">Momentum</span> In 3D Space.
          </h1>
          <p className="hero-description">
            Next-generation mathematical models combined with real-time WebGL visualization. Identify institutional patterns, train localized predictive models, and backtest execution strategies.
          </p>
          <button 
            className="nav-btn" 
            onClick={handleScrollToTerminal} 
            style={{ 
              background: themeColor, 
              color: '#000', 
              borderColor: themeColor, 
              padding: '16px 36px', 
              fontSize: '15px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            Enter Dashboard <ArrowRight size={18} />
          </button>
        </div>

        <div className="hero-3d-container">
          {/* Three.js interactive canvas wrapper */}
          <ThreeCanvas themeColor={themeColor} />

          {/* Interactive Floating Selector Dropdown */}
          <div className="selector-card">
            <div className="selector-header">Asset Terminal Selector</div>
            
            <div className="asset-dropdown">
              <div 
                className="dropdown-trigger" 
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span>{STOCKS[selectedTicker]?.name}</span>
                <ChevronDown size={20} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
              </div>

              {dropdownOpen && (
                <div className="dropdown-menu">
                  {Object.keys(STOCKS).map(ticker => (
                    <div 
                      key={ticker} 
                      className={`dropdown-item ${selectedTicker === ticker ? 'active' : ''}`}
                      onClick={() => handleAssetSelect(ticker)}
                      style={{ color: selectedTicker === ticker ? STOCKS[ticker].color : '' }}
                    >
                      {STOCKS[ticker].name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Control Selectors */}
            <div className="controls-row">
              <select 
                className="control-select" 
                value={period} 
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
                <option value="60d">60 Days</option>
                <option value="90d">90 Days</option>
                <option value="180d">180 Days</option>
                <option value="1y">1 Year</option>
              </select>

              <select 
                className="control-select" 
                value={interval} 
                onChange={(e) => setInterval(e.target.value)}
              >
                <option value="1d">1 Day Bars</option>
                <option value="1h">1 Hour Bars</option>
                <option value="15m">15 Min Bars</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Workspace */}
      <section ref={terminalRef} className="terminal-workspace">
        {loading ? (
          <div className="loading-overlay">
            <div className="spinner" style={{ borderTopColor: themeColor }} />
            <p>Ingesting real-time historical data & compiling indicators...</p>
          </div>
        ) : error ? (
          <div className="loading-overlay">
            <ShieldAlert size={48} style={{ color: 'var(--color-danger)' }} />
            <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{error}</p>
            <button className="nav-btn" onClick={() => fetchData(selectedTicker, period, interval)} style={{ marginTop: '16px' }}>
              Retry Handshake
            </button>
          </div>
        ) : apiData ? (
          <>
            {/* Asset Header Info */}
            <div className="terminal-header">
              <div className="terminal-title-container">
                <h2 className="ticker-title">
                  {apiData.company.longName} <span style={{ color: themeColor, fontSize: '20px' }}>({apiData.ticker})</span>
                </h2>
                <div className="company-sector">
                  {apiData.company.sector} // {apiData.company.country}
                </div>
              </div>
              <div className="controls-row" style={{ marginTop: 0 }}>
                <select 
                  className="control-select" 
                  value={chartMode} 
                  onChange={(e) => setChartMode(e.target.value)}
                  style={{ minWidth: '150px' }}
                >
                  <option value="Price Only">Price Only</option>
                  <option value="Price + Volume">Price + Volume</option>
                  <option value="Price + MACD">Price + MACD</option>
                  <option value="Full Analysis">Full Analysis</option>
                </select>
              </div>
            </div>

            {/* KPI Cards row */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <span className="kpi-label">💰 Market Price</span>
                <span className="kpi-value">${apiData.overview.price.toFixed(2)}</span>
                <span className={`kpi-meta ${apiData.overview.changeValue >= 0 ? 'trend-bullish' : 'trend-bearish'}`}>
                  {apiData.overview.changeValue >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {apiData.overview.changeValue >= 0 ? '+' : ''}{apiData.overview.changeValue.toFixed(2)} ({apiData.overview.changePercent.toFixed(2)}%)
                </span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">📈 RSI Momentum</span>
                <span className="kpi-value" style={{ color: themeColor }}>{apiData.overview.rsi.toFixed(2)}</span>
                <span className="kpi-meta" style={{ color: 'var(--text-muted)' }}>
                  14-Period Osc.
                </span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">📊 Momentum Trend</span>
                <span className="kpi-value">{apiData.overview.trend}</span>
                <span className={`kpi-meta ${apiData.overview.trend === 'Bullish' ? 'trend-bullish' : 'trend-bearish'}`}>
                  MACD Oscillator
                </span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">🎯 Action Signal</span>
                <span className="kpi-value" style={{ color: apiData.overview.signal === 'BUY' ? 'var(--color-primary)' : apiData.overview.signal === 'SELL' ? 'var(--color-danger)' : '#fff' }}>
                  {apiData.overview.signal}
                </span>
                <span className="kpi-meta" style={{ color: 'var(--text-muted)' }}>
                  Indicators Consensus
                </span>
              </div>
            </div>

            {/* Tabs Selector */}
            <div className="tabs-header">
              <button 
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
                style={{ color: activeTab === 'overview' ? themeColor : '' }}
              >
                <Compass size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} /> Overview
              </button>
              <button 
                className={`tab-btn ${activeTab === 'technicals' ? 'active' : ''}`}
                onClick={() => setActiveTab('technicals')}
                style={{ color: activeTab === 'technicals' ? themeColor : '' }}
              >
                <LineChart size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} /> Technicals
              </button>
              <button 
                className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
                onClick={() => setActiveTab('ai')}
                style={{ color: activeTab === 'ai' ? themeColor : '' }}
              >
                <Brain size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} /> AI Insights
              </button>
              <button 
                className={`tab-btn ${activeTab === 'backtest' ? 'active' : ''}`}
                onClick={() => setActiveTab('backtest')}
                style={{ color: activeTab === 'backtest' ? themeColor : '' }}
              >
                <History size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} /> Backtest
              </button>
              <button 
                className={`tab-btn ${activeTab === '3d' ? 'active' : ''}`}
                onClick={() => setActiveTab('3d')}
                style={{ color: activeTab === '3d' ? themeColor : '' }}
              >
                <Boxes size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} /> 3D Visualizer
              </button>
            </div>

            {/* Tab Contents */}
            <div className="tab-contents">
              {activeTab === "overview" && (
                <div className="grid-2col">
                  <div className="panel-card">
                    <h3 className="panel-title">Asset Summary Description</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '14px' }}>
                      {apiData.company.longBusinessSummary}
                    </p>
                  </div>
                  <div className="panel-card">
                    <h3 className="panel-title">Asset Metadata</h3>
                    <div className="info-list">
                      <div className="info-item">
                        <span className="info-item-label">Ticker Symbol</span>
                        <span className="info-item-value" style={{ color: themeColor }}>{apiData.ticker}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">Market Capitalization</span>
                        <span className="info-item-value">${typeof apiData.company.marketCap === 'number' ? apiData.company.marketCap.toLocaleString() : apiData.company.marketCap}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">Industry Classification</span>
                        <span className="info-item-value">{apiData.company.sector}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-item-label">Country</span>
                        <span className="info-item-value">{apiData.company.country}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "technicals" && (
                <div className="panel-card">
                  <h3 className="panel-title">
                    <LineChart size={16} style={{ color: themeColor }} /> Technical Indicators Chart Workspace ({chartMode})
                  </h3>
                  <div className="chart-container">
                    {(() => {
                      const { data, layout } = getTechnicalsPlotData();
                      return <PlotlyChart data={data} layout={layout} />;
                    })()}
                  </div>
                </div>
              )}

              {activeTab === "ai" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Row 1: Reasoning + Selected Model Forecast */}
                  <div className="grid-2col">
                    {/* Left Column: AI reasoning, confidence, prediction */}
                    <div className="panel-card">
                      <h3 className="panel-title">
                        <Brain size={16} style={{ color: themeColor }} /> AI Algorithmic Reasoning
                      </h3>
                      <div className="ai-reasoning-list">
                        {apiData.overview.rsi > 70 ? (
                          <div className="ai-reasoning-item danger">
                            • Relative Strength Index (RSI) is above 70, reflecting highly overbought conditions. High risk of profit-taking.
                          </div>
                        ) : apiData.overview.rsi < 30 ? (
                          <div className="ai-reasoning-item">
                            • Relative Strength Index (RSI) is below 30, reflecting highly oversold conditions. Price rejection point identified.
                          </div>
                        ) : (
                          <div className="ai-reasoning-item">
                            • Relative Strength Index (RSI) is in neutral bounds ({apiData.overview.rsi}), indicating stable, balanced volume velocity.
                          </div>
                        )}

                        {apiData.overview.macd > apiData.overview.macdSignal ? (
                          <div className="ai-reasoning-item">
                            • MACD Line is tracking above the Signal Line, verifying strong bullish momentum.
                          </div>
                        ) : (
                          <div className="ai-reasoning-item danger">
                            • MACD Line is tracking below the Signal Line, verifying strong bearish volume distribution.
                          </div>
                        )}

                        {apiData.historical[apiData.historical.length - 1].ema_12 > apiData.historical[apiData.historical.length - 1].sma_20 ? (
                          <div className="ai-reasoning-item">
                            • EMA 12 is tracking above the SMA 20, confirming that the short-term trend remains positive.
                          </div>
                        ) : (
                          <div className="ai-reasoning-item warning">
                            • EMA 12 is tracking below the SMA 20, confirming that the short-term trend remains structurally weak.
                          </div>
                        )}
                      </div>

                      <div className="health-meter-container" style={{ marginTop: '20px' }}>
                        <span className="kpi-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>📊 Quant Market Health Score</span>
                          <span style={{ color: themeColor, fontWeight: 700 }}>{getMarketHealthScore()}/100</span>
                        </span>
                        <div className="progress-bar-track">
                          <div 
                            className="progress-bar-fill" 
                            style={{ 
                              width: `${getMarketHealthScore()}%`,
                              background: `linear-gradient(to right, #a855f7, ${themeColor})`,
                              boxShadow: `0 0 10px ${themeColor}60`
                            }} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Active ML prediction results */}
                    <div className="panel-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '8px' }}>
                        <h3 className="panel-title" style={{ border: 'none', padding: 0, margin: 0 }}>
                          <Cpu size={16} style={{ color: themeColor }} /> Forecast Engine
                        </h3>
                        <select 
                          className="control-select" 
                          value={selectedModel} 
                          onChange={(e) => setSelectedModel(e.target.value)}
                          style={{ minWidth: '160px', padding: '6px 10px', fontSize: '11px' }}
                        >
                          <option value="Random Forest">Random Forest</option>
                          <option value="Logistic Regression">Logistic Regression</option>
                          <option value="Gradient Boosting">Gradient Boosting</option>
                        </select>
                      </div>

                      {apiData.ml.hasEnoughData ? (
                        (() => {
                          const activeModelData = apiData.ml.comparison?.find(m => m.modelName === selectedModel) || apiData.ml.comparison?.[0];
                          if (!activeModelData) return null;
                          
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              <div style={{ padding: '20px', borderRadius: '12px', background: activeModelData.prediction === 'UP' ? 'rgba(0, 255, 170, 0.08)' : 'rgba(239, 68, 68, 0.08)', border: `1px solid ${activeModelData.prediction === 'UP' ? 'rgba(0, 255, 170, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, textAlign: 'center' }}>
                                <span className="kpi-label">Day-Ahead Trend Prediction</span>
                                <h4 style={{ fontSize: '26px', color: activeModelData.prediction === 'UP' ? 'var(--color-primary)' : 'var(--color-danger)', marginTop: '8px' }}>
                                  {activeModelData.prediction === 'UP' ? '📈 TARGET UP' : '📉 TARGET DOWN'}
                                </h4>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
                                  Confidence: <strong>{activeModelData.probability}%</strong>
                                </span>
                              </div>

                              <div className="info-list">
                                <div className="info-item">
                                  <span className="info-item-label">Model Accuracy ({selectedModel})</span>
                                  <span className="info-item-value">{activeModelData.accuracy}%</span>
                                </div>
                                
                                <div style={{ marginTop: '10px' }}>
                                  <span className="kpi-label" style={{ marginBottom: '8px', display: 'block' }}>Key Feature Weights</span>
                                  {activeModelData.featureImportance.slice(0, 3).map((feat, idx) => (
                                    <div key={idx} className="info-item" style={{ fontSize: '12px', paddingBottom: '6px', paddingTop: '6px' }}>
                                      <span style={{ fontFamily: 'monospace' }}>{feat.feature}</span>
                                      <span style={{ color: themeColor }}>{(feat.importance * 100).toFixed(1)}%</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                          <ShieldAlert size={36} style={{ margin: '0 auto 12px auto' }} />
                          <p style={{ fontSize: '13px' }}>Insufficient rows to initialize localized classifiers. Expand dataset time period.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Model Benchmarking Comparisons */}
                  {apiData.ml.hasEnoughData && (
                    <div className="grid-2col">
                      {/* Left: Accuracy Comparison Chart */}
                      <div className="panel-card" style={{ gap: '16px' }}>
                        <h4 className="panel-title" style={{ border: 'none', padding: 0, margin: 0 }}>Accuracy Benchmarking</h4>
                        <div style={{ height: '250px' }}>
                          {(() => {
                            const plot = getAccuracyComparisonPlotData();
                            return <PlotlyChart data={plot.data} layout={plot.layout} />;
                          })()}
                        </div>
                      </div>

                      {/* Right: Benchmarking Data Table */}
                      <div className="panel-card" style={{ gap: '16px' }}>
                        <h4 className="panel-title" style={{ border: 'none', padding: 0, margin: 0 }}>Model Matrix</h4>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Model</th>
                                <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Prediction</th>
                                <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Test Accuracy</th>
                              </tr>
                            </thead>
                            <tbody>
                              {apiData.ml.comparison?.map((m, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{m.modelName}</td>
                                  <td style={{ padding: '10px 12px', fontWeight: 600, color: m.prediction === 'UP' ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                                    {m.prediction}
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>{m.accuracy}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "backtest" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Top Control Panel */}
                  <div className="panel-card">
                    <h3 className="panel-title">
                      <History size={16} style={{ color: themeColor }} /> SMA/EMA Crossover Strategy Parameter Customizer
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
                      Optimize strategy thresholds by customizing backtest windows. Buy signals occur when Fast EMA crosses above Slow SMA, and sell/liquidate signals occur on downward crosses.
                    </p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span className="kpi-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Fast EMA Window</span>
                          <span style={{ color: themeColor, fontWeight: 700 }}>{inputShort} Days</span>
                        </span>
                        <input 
                          type="range" min="2" max="50" step="1"
                          value={inputShort}
                          onChange={(e) => setInputShort(parseInt(e.target.value))}
                          style={{ accentColor: themeColor, cursor: 'pointer' }}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span className="kpi-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Slow SMA Window</span>
                          <span style={{ color: themeColor, fontWeight: 700 }}>{inputLong} Days</span>
                        </span>
                        <input 
                          type="range" min="5" max="200" step="1"
                          value={inputLong}
                          onChange={(e) => setInputLong(parseInt(e.target.value))}
                          style={{ accentColor: themeColor, cursor: 'pointer' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span className="kpi-label">Initial Capital ($)</span>
                        <input 
                          type="number" min="100" max="1000000" step="500"
                          value={inputCapital}
                          onChange={(e) => setInputCapital(parseFloat(e.target.value) || 10000)}
                          style={{ 
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            color: '#fff',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                      <button 
                        className="nav-btn" 
                        onClick={handleRunBacktest}
                        style={{ background: themeColor, color: '#000', borderColor: themeColor }}
                      >
                        Run Custom Backtest
                      </button>
                    </div>
                  </div>

                  {/* Results Panel */}
                  <div className="grid-2col">
                    {/* Left side: statistics and Equity curve */}
                    <div className="panel-card" style={{ gap: '16px' }}>
                      <h4 className="panel-title" style={{ border: 'none', padding: 0, margin: 0 }}>Performance Metrics</h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <div className="backtest-box">
                          <span className="kpi-label" style={{ fontSize: '9px' }}>Win Rate</span>
                          <h5 style={{ fontSize: '18px', marginTop: '4px', color: themeColor }}>{apiData.backtest.winRate}%</h5>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{apiData.backtest.winningTrades} / {apiData.backtest.totalTrades} trades</span>
                        </div>
                        <div className="backtest-box">
                          <span className="kpi-label" style={{ fontSize: '9px' }}>Profit Factor</span>
                          <h5 style={{ fontSize: '18px', marginTop: '4px' }}>{apiData.backtest.profitFactor}</h5>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Gross Profit/Loss</span>
                        </div>
                        <div className="backtest-box">
                          <span className="kpi-label" style={{ fontSize: '9px' }}>Max Drawdown</span>
                          <h5 style={{ fontSize: '18px', marginTop: '4px', color: 'var(--color-danger)' }}>-{apiData.backtest.maxDrawdown.toFixed(1)}%</h5>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Peak-to-Trough drop</span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        <div className="backtest-box">
                          <span className="kpi-label" style={{ fontSize: '9px' }}>Net Return</span>
                          <h5 style={{ fontSize: '18px', marginTop: '4px', color: apiData.backtest.returnPercent >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                            {apiData.backtest.returnPercent >= 0 ? '+' : ''}{apiData.backtest.returnPercent}%
                          </h5>
                        </div>
                        <div className="backtest-box">
                          <span className="kpi-label" style={{ fontSize: '9px' }}>Final Balance</span>
                          <h5 style={{ fontSize: '18px', marginTop: '4px', color: apiData.backtest.returnPercent >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                            ${apiData.backtest.finalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </h5>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                        <span className="kpi-label" style={{ marginBottom: '8px', display: 'block' }}>Portfolio Equity Curve</span>
                        <div style={{ height: '280px' }}>
                          {(() => {
                            const plot = getEquityCurvePlotData();
                            return <PlotlyChart data={plot.data} layout={plot.layout} />;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Trade Ledger List */}
                    <div className="panel-card" style={{ gap: '16px' }}>
                      <h4 className="panel-title" style={{ border: 'none', padding: 0, margin: 0 }}>Transaction Ledger</h4>
                      
                      <div style={{ overflowY: 'auto', maxHeight: '430px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                              <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Date</th>
                              <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Action</th>
                              <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Price</th>
                              <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Shares</th>
                              <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Profit/Loss</th>
                            </tr>
                          </thead>
                          <tbody>
                            {apiData.backtest.tradesLog.length === 0 ? (
                              <tr>
                                <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                  No transaction signals generated in this timeframe. Try tightening the windows.
                                </td>
                              </tr>
                            ) : (
                              apiData.backtest.tradesLog.map((trade, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{trade.date}</td>
                                  <td style={{ padding: '10px 12px', fontWeight: 600, color: trade.action === 'BUY' ? 'var(--color-blue)' : trade.action === 'SELL' ? 'var(--color-primary)' : 'var(--color-warning)' }}>
                                    {trade.action}
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>${trade.price.toFixed(2)}</td>
                                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{trade.shares}</td>
                                  <td style={{ padding: '10px 12px', fontWeight: 600, color: trade.profit > 0 ? 'var(--color-primary)' : trade.profit < 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                                    {trade.profit > 0 ? `+$${trade.profit.toFixed(2)}` : trade.profit < 0 ? `-$${Math.abs(trade.profit).toFixed(2)}` : '-'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "3d" && (
                <div className="panel-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="panel-title" style={{ border: 'none', padding: 0, margin: 0 }}>
                      <Boxes size={16} style={{ color: themeColor }} /> 3D Quant Engine Rendering Space
                    </h3>
                    <select 
                      className="control-select" 
                      value={threeVizMode} 
                      onChange={(e) => setThreeVizMode(e.target.value)}
                      style={{ minWidth: '240px' }}
                    >
                      <option value="3D Price-Volume-RSI Trajectory">3D Price-Volume-RSI Trajectory</option>
                      <option value="3D ML Decision Space">3D ML Decision Space</option>
                      <option value="3D Volatility Term Structure Surface">3D Volatility Surface</option>
                    </select>
                  </div>
                  
                  <div className="chart-container" style={{ minHeight: '620px' }}>
                    {(() => {
                      const plot = get3DPlotData();
                      if (plot.error) {
                        return (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '620px', color: 'var(--text-muted)' }}>
                            <p>{plot.error}</p>
                          </div>
                        );
                      }
                      return <PlotlyChart data={plot.data} layout={plot.layout} />;
                    })()}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </section>

      {/* Floating Chat Copilot Button */}
      <button 
        className="chat-toggle-btn" 
        onClick={() => setChatOpen(!chatOpen)}
        style={{ borderColor: themeColor, boxShadow: `0 0 15px ${themeColor}40` }}
      >
        <Brain size={24} style={{ color: themeColor }} />
      </button>

      {/* Floating Side Drawer */}
      <div className={`chat-drawer ${chatOpen ? 'open' : ''}`} style={{ borderLeftColor: themeColor }}>
        <div className="chat-drawer-header" style={{ borderBottomColor: `rgba(255,255,255,0.08)` }}>
          <div className="chat-drawer-title">
            <Cpu size={18} style={{ color: themeColor }} />
            <span>QUANT_CO-PILOT_v1.0</span>
          </div>
          <button className="chat-drawer-close" onClick={() => setChatOpen(false)}>✕</button>
        </div>
        
        <div className="chat-messages">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`chat-msg ${msg.sender}`}>
              {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area" style={{ borderTopColor: `rgba(255,255,255,0.08)` }}>
          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input 
              type="text" 
              className="chat-text-input" 
              placeholder="Query terminal matrix..." 
              value={chatInputText}
              onChange={(e) => setChatInputText(e.target.value)}
              style={{ caretColor: themeColor }}
            />
            <button className="chat-send-btn" type="submit" style={{ borderColor: themeColor }}>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
