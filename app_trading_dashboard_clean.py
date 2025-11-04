
import streamlit as st
import pandas as pd
import yfinance as yf
import ta
import plotly.graph_objects as go

# --- PAGE CONFIG ---
st.set_page_config(page_title="AI Quant Dashboard", page_icon="💹", layout="wide")

# --- STYLES ---
st.markdown("""
    <style>
    .big-font {font-size:22px !important;}
    .center {text-align: center;}
    </style>
""", unsafe_allow_html=True)

# --- HEADER ---
st.markdown("<h1 class='center'>💹 AI Quant Trading Dashboard</h1>", unsafe_allow_html=True)
st.markdown("<p class='center'>Your personal AI-driven stock analysis terminal</p>", unsafe_allow_html=True)
st.divider()

# --- SIDEBAR ---
st.sidebar.header("⚙️ Settings")

stock_options = {
    "📈 Apple Inc. (AAPL)": "AAPL",
    "🚗 Tesla (TSLA)": "TSLA",
    "💻 Microsoft (MSFT)": "MSFT",
    "🛒 Amazon (AMZN)": "AMZN",
    "💡 NVIDIA (NVDA)": "NVDA",
    "🏢 Reliance (RELIANCE.NS)": "RELIANCE.NS",
    "🧠 Infosys (INFY.NS)": "INFY.NS",
    "💰 HDFC Bank (HDFCBANK.NS)": "HDFCBANK.NS",
    "₿ Bitcoin (BTC-USD)": "BTC-USD",
    "Ξ Ethereum (ETH-USD)": "ETH-USD"
}

ticker = stock_options[st.sidebar.selectbox("Select Asset", list(stock_options.keys()))]
interval = st.sidebar.selectbox("Interval", ["1d", "1h", "15m"], index=0)
period = st.sidebar.selectbox("Period", ["7d", "30d", "60d", "90d", "180d", "1y"], index=1)

# Auto-adjust intraday limits
if interval in ["1h", "15m"] and period not in ["7d", "30d", "60d"]:
    st.sidebar.warning("⚠️ Intraday limited to 60 days. Adjusted automatically.")
    period = "60d"

# --- FETCH DATA ---
@st.cache_data
def load_data(ticker, period, interval):
    t = yf.Ticker(ticker)
    df = t.history(period=period, interval=interval)
    df.reset_index(inplace=True)
    df.rename(columns={"Date": "date", "Open": "open", "High": "high",
                       "Low": "low", "Close": "close", "Volume": "volume"}, inplace=True)
    info = t.info if hasattr(t, "info") else {}
    return df, info

df, info = load_data(ticker, period, interval)
if df.empty:
    st.error("❌ No data found for this asset.")
    st.stop()

# --- TABS ---
tab1, tab2, tab3, tab4 = st.tabs(["🏢 Overview", "📊 Technicals", "🤖 AI Insights", "📈 Backtest"])

# ============ TAB 1: OVERVIEW ============
with tab1:
    st.subheader(f"🏢 {info.get('longName', ticker)}")
    col1, col2 = st.columns([2, 3])
    with col1:
        st.metric("Current Price", f"${df['close'].iloc[-1]:.2f}")
        st.metric("Market Cap", f"${info.get('marketCap', 0):,}")
        st.metric("Sector", info.get("sector", "N/A"))
        st.metric("Country", info.get("country", "N/A"))
    with col2:
        st.markdown("**Company Summary:**")
        st.info(info.get("longBusinessSummary", "No summary available."))

# ============ TAB 2: TECHNICALS ============
with tab2:
    st.subheader("📊 Price Chart with Indicators")
    df["sma_20"] = df["close"].rolling(20).mean()
    df["ema_12"] = df["close"].ewm(span=12, adjust=False).mean()
    df["rsi"] = ta.momentum.RSIIndicator(df["close"]).rsi()

    fig = go.Figure()
    fig.add_trace(go.Candlestick(x=df["date"], open=df["open"], high=df["high"],
                                 low=df["low"], close=df["close"],
                                 name="Candles", increasing_line_color="green", decreasing_line_color="red"))
    fig.add_trace(go.Scatter(x=df["date"], y=df["sma_20"], mode="lines", name="SMA 20", line=dict(color="orange")))
    fig.add_trace(go.Scatter(x=df["date"], y=df["ema_12"], mode="lines", name="EMA 12", line=dict(color="cyan")))
    fig.update_layout(template="plotly_dark", xaxis_title="Date", yaxis_title="Price", hovermode="x unified")
    st.plotly_chart(fig, use_container_width=True)

    # RSI Plot
    st.subheader("📉 RSI Indicator")
    fig_rsi = go.Figure()
    fig_rsi.add_trace(go.Scatter(x=df["date"], y=df["rsi"], line=dict(color="lightblue", width=2)))
    fig_rsi.add_hline(y=70, line=dict(color="red", dash="dash"), annotation_text="Overbought")
    fig_rsi.add_hline(y=30, line=dict(color="green", dash="dash"), annotation_text="Oversold")
    fig_rsi.update_layout(template="plotly_dark", height=250, xaxis_title="Date", yaxis_title="RSI")
    st.plotly_chart(fig_rsi, use_container_width=True)

# ============ TAB 3: AI INSIGHTS ============
with tab3:
    st.subheader("🤖 AI Trading Signal")
    ema, sma, rsi = df["ema_12"].iloc[-1], df["sma_20"].iloc[-1], df["rsi"].iloc[-1]

    if ema > sma and rsi < 60:
        signal = "BUY"
        color = "green"
        text = "AI suggests a bullish signal — short-term upward momentum."
    elif ema < sma and rsi > 40:
        signal = "SELL"
        color = "red"
        text = "AI suggests a bearish signal — momentum weakening."
    else:
        signal = "HOLD"
        color = "orange"
        text = "Market appears neutral — wait for stronger signal confirmation."

    st.markdown(f"<h2 style='text-align:center; color:{color};'>{signal}</h2>", unsafe_allow_html=True)
    st.info(text)
    st.markdown("##### Supporting Indicators")
    st.write(f"📊 EMA: {ema:.2f}  |  SMA: {sma:.2f}  |  RSI: {rsi:.2f}")

# ============ TAB 4: BACKTEST ============
with tab4:
    st.subheader("📈 Backtest Simulation")
    initial_balance = 10000
    balance = initial_balance
    position = 0

    for i in range(1, len(df)):
        price = df.loc[i, "close"]
        if ema > sma and position == 0:
            entry = price
            position = 1
        elif ema < sma and position == 1:
            balance += price - entry
            position = 0
    if position == 1:
        balance += df.iloc[-1]["close"] - entry

    profit = balance - initial_balance
    st.metric("💰 Final Balance", f"${balance:,.2f}", f"{profit / initial_balance * 100:.2f}%")
    st.success("✅ Backtest complete.")
