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

# Intraday restriction
if interval in ["1h", "15m"] and period not in ["7d", "30d", "60d"]:
    st.sidebar.warning("⚠️ Intraday limited to 60 days. Adjusted automatically.")
    period = "60d"

# --- DATA FETCH ---
@st.cache_data(ttl=300)
def load_data(ticker, period, interval):
    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period, interval=interval)

        if df.empty:
            return None

        df.reset_index(inplace=True)
        df.rename(columns={
            "Date": "date",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume"
        }, inplace=True)

        return df

    except Exception:
        return None

df = load_data(ticker, period, interval)

if df is None:
    st.error("❌ Data fetch failed or rate limit hit. Please wait and try again.")
    st.stop()

# --- INDICATORS ---
df["sma_20"] = df["close"].rolling(20).mean()
df["ema_12"] = df["close"].ewm(span=12, adjust=False).mean()
df["rsi"] = ta.momentum.RSIIndicator(df["close"]).rsi()

# --- TABS ---
tab1, tab2, tab3, tab4 = st.tabs(["🏢 Overview", "📊 Technicals", "🤖 AI Insights", "📈 Backtest"])

# ============ TAB 1 ============
with tab1:
    st.subheader(f"🏢 {ticker}")

    current_price = df['close'].iloc[-1]
    prev_price = df['close'].iloc[-2]

    change = current_price - prev_price
    change_pct = (change / prev_price) * 100

    col1, col2, col3 = st.columns(3)

    col1.metric("Current Price", f"${current_price:.2f}", f"{change_pct:.2f}%")

    col2.metric("Volume", f"{int(df['volume'].iloc[-1]):,}")

    col3.metric("Trend (EMA vs SMA)", 
        "Bullish" if df["ema_12"].iloc[-1] > df["sma_20"].iloc[-1] else "Bearish"
    )

    st.divider()

    # Mini insight
    st.markdown("### 📊 Quick Insight")

    if df["ema_12"].iloc[-1] > df["sma_20"].iloc[-1]:
        st.success("Short-term momentum is positive (EMA above SMA).")
    else:
        st.error("Short-term momentum is weakening (EMA below SMA).")

    if df["rsi"].iloc[-1] > 70:
        st.warning("Stock may be overbought.")
    elif df["rsi"].iloc[-1] < 30:
        st.warning("Stock may be oversold.")
    else:
        st.info("RSI is in neutral zone.")
# ============ TAB 2 ============
with tab2:
    st.subheader("📊 Price Chart with Indicators")

    fig = go.Figure()
    fig.add_trace(go.Candlestick(
        x=df["date"],
        open=df["open"],
        high=df["high"],
        low=df["low"],
        close=df["close"],
        name="Candles",
        increasing_line_color="green",
        decreasing_line_color="red"
    ))

    fig.add_trace(go.Scatter(x=df["date"], y=df["sma_20"], mode="lines", name="SMA 20", line=dict(color="orange")))
    fig.add_trace(go.Scatter(x=df["date"], y=df["ema_12"], mode="lines", name="EMA 12", line=dict(color="cyan")))

    fig.update_layout(template="plotly_dark", xaxis_title="Date", yaxis_title="Price")
    st.plotly_chart(fig, use_container_width=True)

    # RSI
    st.subheader("📉 RSI Indicator")
    fig_rsi = go.Figure()
    fig_rsi.add_trace(go.Scatter(x=df["date"], y=df["rsi"], line=dict(color="lightblue")))
    fig_rsi.add_hline(y=70, line=dict(color="red", dash="dash"))
    fig_rsi.add_hline(y=30, line=dict(color="green", dash="dash"))
    fig_rsi.update_layout(template="plotly_dark", height=250)
    st.plotly_chart(fig_rsi, use_container_width=True)

# ============ TAB 3 ============
with tab3:
    st.subheader("🤖 AI Trading Signal")

    ema = df["ema_12"].iloc[-1]
    sma = df["sma_20"].iloc[-1]
    rsi = df["rsi"].iloc[-1]

    if ema > sma and rsi < 60:
        signal = "BUY"
        color = "green"
        text = "Bullish signal — upward momentum."
    elif ema < sma and rsi > 40:
        signal = "SELL"
        color = "red"
        text = "Bearish signal — downward trend."
    else:
        signal = "HOLD"
        color = "orange"
        text = "Neutral — wait for confirmation."

    st.markdown(f"<h2 style='text-align:center; color:{color};'>{signal}</h2>", unsafe_allow_html=True)
    st.info(text)

# ============ TAB 4 ============
with tab4:
    st.subheader("📈 Backtest Simulation")

    initial_balance = 10000
    balance = initial_balance
    position = 0
    entry = 0

    for i in range(1, len(df)):
        price = df.loc[i, "close"]
        ema = df.loc[i, "ema_12"]
        sma = df.loc[i, "sma_20"]

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