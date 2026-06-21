import streamlit as st
import pandas as pd
import yfinance as yf
import ta
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

# ---------------- CONFIG ----------------
st.set_page_config(page_title="AI Quant Dashboard", layout="wide")
# ---------------- CUSTOM CSS ----------------
st.markdown("""
<style>

/* KPI Cards */
[data-testid="stMetric"]{
    background: #0f172a;
    border: 1px solid #1e293b;
    padding: 20px;
    border-radius: 16px;
    text-align: center;
    box-shadow: 0px 0px 20px rgba(0,255,150,0.08);
}

/* Sidebar */
section[data-testid="stSidebar"]{
    background-color:#0b1220;
}

/* Main App */
.stApp{
    background-color:#050b16;
}

/* Tabs */
button[data-baseweb="tab"]{
    font-size:16px;
}
.stTabs [data-baseweb="tab-list"] {
    gap: 20px;
}

.stTabs [data-baseweb="tab"] {
    height: 50px;
    border-radius: 10px;
}

</style>
""", unsafe_allow_html=True)
    

st.markdown("# Quant AI Terminal")
st.caption("AI-Powered Market Analysis & Trading Dashboard")

# ---------------- SIDEBAR ----------------
st.sidebar.header("⚙️ Settings")

stock_options = {
    "Apple Inc. (AAPL)": "AAPL",
    "Tesla (TSLA)": "TSLA",
    "Microsoft (MSFT)": "MSFT",
    "Amazon (AMZN)": "AMZN",
    "NVIDIA (NVDA)": "NVDA",
    "Reliance (RELIANCE.NS)": "RELIANCE.NS",
    "Infosys (INFY.NS)": "INFY.NS",
}

ticker_name = st.sidebar.selectbox("Select Asset", list(stock_options.keys()))
ticker = stock_options[ticker_name]

interval = st.sidebar.selectbox("Interval", ["1d", "1h", "15m"], index=0)
period = st.sidebar.selectbox("Period", ["7d", "30d", "60d", "90d", "180d", "1y"], index=1)
chart_mode = st.sidebar.selectbox(
    "Technical View",
    [
        "Price Only",
        "Price + Volume",
        "Price + MACD",
        "Full Analysis"
    ]
)

# ---------------- DATA ----------------
df = yf.download(ticker, period=period, interval=interval)

if df.empty:
    st.error("No data found")
    st.stop()

# ✅ FIX 1: flatten columns (yfinance bug)
df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]

df = df.dropna()

# ---------------- COMPANY INFO ----------------
info = {}
try:
    t = yf.Ticker(ticker)
    info = t.info
except:
    info = {}

# ---------------- INDICATORS ----------------
close = df["Close"]

# ✅ ensure it's a proper Series
if isinstance(close, pd.DataFrame):
    close = close.iloc[:, 0]

df["sma_20"] = close.rolling(20).mean()
df["ema_12"] = close.ewm(span=12, adjust=False).mean()

# ✅ FINAL RSI FIX (correct one)
df["rsi"] = ta.momentum.RSIIndicator(close).rsi()
macd = ta.trend.MACD(close)
bollinger = ta.volatility.BollingerBands(close)

df["bb_high"] = bollinger.bollinger_hband()
df["bb_low"] = bollinger.bollinger_lband()
df["bb_mid"] = bollinger.bollinger_mavg()

df["macd"] = macd.macd()
df["macd_signal"] = macd.macd_signal()
df["macd_hist"] = (
    df["macd"] - df["macd_signal"]
)

# Tomorrow's movement

# Tomorrow's movement

df["target"] = (
    df["Close"].shift(-1) > df["Close"]
).astype(int)

df_ml = df.dropna().copy()



# ---------------- TABS ----------------
tab1, tab2, tab3, tab4 = st.tabs(["📊 Overview", "📈 Technicals", "🤖 AI Insights", "📉 Backtest"])
if len(df) == 0:
    st.error("DataFrame is empty after processing")
    st.stop()
latest_rsi = df["rsi"].iloc[-1]
latest_macd = df["macd"].iloc[-1]

if latest_macd > 0:
    trend = "Bullish 📈"
else:
    trend = "Bearish 📉"

signal = "BUY" if latest_rsi < 70 and latest_macd > 0 else "HOLD"
# ================= OVERVIEW =================
with tab1:
    latest_rsi = df["rsi"].iloc[-1]
    latest_macd = df["macd"].iloc[-1]

    if latest_macd > 0:
        trend = "Bullish 📈"
    else:
        trend = "Bearish 📉"

    signal = "BUY" if latest_rsi < 70 and latest_macd > 0 else "HOLD"

    k1, k2, k3, k4 = st.columns(4)

    k1.metric(
    "💰 Price",
    f"${close.iloc[-1]:.2f}"
)

    k2.metric(
    "📊 RSI",
    f"{latest_rsi:.2f}"
)

    k3.metric(
    "📈 Trend",
    trend
)

    k4.metric(
    "🎯 Signal",
    signal
)
    col1, col2 = st.columns(2)
    with col1:
        st.subheader(ticker_name)

        current_price = close.iloc[-1]
        prev_price = close.iloc[-2]

        change = current_price - prev_price
        change_pct = (change / prev_price) * 100

        st.metric("Current Price", f"${current_price:.2f}", f"{change_pct:.2f}%")

        st.write("Market Cap:", info.get("marketCap", "N/A"))
        st.write("Sector:", info.get("sector", "N/A"))
        st.write("Country:", info.get("country", "N/A"))

    with col2:
    
        st.subheader("Company Summary:")
        st.info(info.get("longBusinessSummary", "No data available"))

# ================= TECHNICALS =================
with tab2:

    st.write("Selected Mode:", chart_mode)

    volume_colors = [
        "green" if close >= open_ else "red"
        for close, open_ in zip(df["Close"], df["Open"])
    ]

    hist_colors = [
        "green" if val >= 0 else "red"
        for val in df["macd_hist"]
    ]

    # ---------------- PRICE ONLY ----------------
    if chart_mode == "Price Only":

        fig = make_subplots(rows=1, cols=1)

        fig.add_trace(
            go.Candlestick(
                x=df.index,
                open=df["Open"],
                high=df["High"],
                low=df["Low"],
                close=df["Close"],
                name="Candlestick"
            )
        )

        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df["sma_20"],
                name="SMA"
            )
        )

        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df["ema_12"],
                name="EMA"
            )
        )

    # ---------------- PRICE + VOLUME ----------------
    elif chart_mode == "Price + Volume":

        fig = make_subplots(
            rows=2,
            cols=1,
            shared_xaxes=True,
            row_heights=[0.8, 0.2]
        )

        fig.add_trace(
            go.Candlestick(
                x=df.index,
                open=df["Open"],
                high=df["High"],
                low=df["Low"],
                close=df["Close"],
                name="Candlestick"
            ),
            row=1,
            col=1
        )

        fig.add_trace(
            go.Bar(
                x=df.index,
                y=df["Volume"],
                name="Volume",
                marker_color=volume_colors
            ),
            row=2,
            col=1
        )

    # ---------------- PRICE + MACD ----------------
    elif chart_mode == "Price + MACD":

        fig = make_subplots(
            rows=2,
            cols=1,
            shared_xaxes=True,
            row_heights=[0.75, 0.25]
        )

        fig.add_trace(
            go.Candlestick(
                x=df.index,
                open=df["Open"],
                high=df["High"],
                low=df["Low"],
                close=df["Close"],
                name="Candlestick"
            ),
            row=1,
            col=1
        )

        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df["macd"],
                name="MACD"
            ),
            row=2,
            col=1
        )

        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df["macd_signal"],
                name="Signal Line"
            ),
            row=2,
            col=1
        )

        fig.add_trace(
            go.Bar(
                x=df.index,
                y=df["macd_hist"],
                name="Histogram",
                marker_color=hist_colors
            ),
            row=2,
            col=1
        )

    # ---------------- FULL ANALYSIS ----------------
    else:

        fig = make_subplots(
            rows=3,
            cols=1,
            shared_xaxes=True,
            vertical_spacing=0.03,
            row_heights=[0.7, 0.15, 0.15]
        )

        # Price
        fig.add_trace(
            go.Candlestick(
                x=df.index,
                open=df["Open"],
                high=df["High"],
                low=df["Low"],
                close=df["Close"],
                name="Candlestick"
            ),
            row=1,
            col=1
        )

        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df["sma_20"],
                name="SMA"
            ),
            row=1,
            col=1
        )

        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df["ema_12"],
                name="EMA"
            ),
            row=1,
            col=1
        )

        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df["bb_high"],
                name="BB Upper"
            ),
            row=1,
            col=1
        )

        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df["bb_low"],
                name="BB Lower"
            ),
            row=1,
            col=1
        )

        # Volume
        fig.add_trace(
            go.Bar(
                x=df.index,
                y=df["Volume"],
                name="Volume",
                marker_color=volume_colors
            ),
            row=2,
            col=1
        )

        # MACD
        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df["macd"],
                name="MACD"
            ),
            row=3,
            col=1
        )

        fig.add_trace(
            go.Scatter(
                x=df.index,
                y=df["macd_signal"],
                name="Signal Line"
            ),
            row=3,
            col=1
        )

        fig.add_trace(
            go.Bar(
                x=df.index,
                y=df["macd_hist"],
                name="Histogram",
                marker_color=hist_colors
            ),
            row=3,
            col=1
        )

    fig.update_layout(
        height=800,
        xaxis_rangeslider_visible=False,
        template="plotly_dark"
    )

    st.plotly_chart(fig, use_container_width=True)

# ================= AI =================
# ================= AI =================
with tab3:

    ema = df["ema_12"].iloc[-1]
    sma = df["sma_20"].iloc[-1]
    rsi = df["rsi"].iloc[-1]
    macd_value = df["macd"].iloc[-1]
    macd_signal = df["macd_signal"].iloc[-1]

    st.header("🤖 AI Market Analyst")

    # ---------------- SIGNAL ----------------

    if ema > sma and macd_value > macd_signal and rsi < 70:

        recommendation = "BUY"
        confidence = 85
        risk = "Medium"

    elif ema < sma and macd_value < macd_signal:

        recommendation = "SELL"
        confidence = 80
        risk = "High"

    else:

        recommendation = "HOLD"
        confidence = 65
        risk = "Low"
    st.subheader("Current Indicators")

    c1,c2,c3 = st.columns(3)

    c1.metric("RSI", f"{rsi:.2f}")
    c2.metric("MACD", f"{macd_value:.2f}")
    c3.metric("EMA vs SMA", f"{ema - sma:.2f}")

    # ---------------- KPI ----------------

    c1, c2, c3 = st.columns(3)

    c1.metric("Recommendation", recommendation)
    c2.metric("Confidence", f"{confidence}%")
    c3.metric("Risk Level", risk)

    st.divider()

    # ---------------- REASONING ----------------

    st.subheader("AI Reasoning")

    if rsi > 70:
        st.write("• RSI indicates overbought conditions.")
    elif rsi < 30:
        st.write("• RSI indicates oversold conditions.")
    else:
        st.write("• RSI is neutral.")

    if macd_value > macd_signal:
        st.write("• MACD is above signal line (Bullish Momentum).")
    else:
        st.write("• MACD is below signal line (Bearish Momentum).")

    if ema > sma:
        st.write("• Short-term trend remains positive.")
    else:
        st.write("• Short-term trend remains weak.")
        st.divider()

    trend_score = 40 if ema > sma else 20
    momentum_score = 30 if macd_value > macd_signal else 15
    

    if 40 <= rsi <= 60:
        rsi_score = 30
    else:
        rsi_score = 15

    health_score = trend_score + momentum_score + rsi_score

    st.subheader("📊 Market Health Score")

    st.progress(health_score / 100)

    st.metric(
        "Overall Score",
        f"{health_score}/100"
    )



# ================= BACKTEST =================
with tab4:
    balance = 10000
    position = 0
    entry = 0

    for i in range(1, len(df)):
        price = df["Close"].iloc[i]
        ema = df["ema_12"].iloc[i]
        sma = df["sma_20"].iloc[i]

        if ema > sma and position == 0:
            entry = price
            position = 1

        elif ema < sma and position == 1:
            balance += price - entry
            position = 0

    if position == 1:
        balance += df["Close"].iloc[-1] - entry

    st.metric("Final Balance", f"${balance:.2f}")