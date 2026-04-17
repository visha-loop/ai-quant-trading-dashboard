import streamlit as st
import pandas as pd
import yfinance as yf
import ta
import plotly.graph_objects as go

st.set_page_config(page_title="AI Quant Dashboard", page_icon="💹", layout="wide")

st.markdown("<h1 style='text-align:center;'>💹 AI Quant Trading Dashboard</h1>", unsafe_allow_html=True)
st.divider()

st.sidebar.header("⚙️ Settings")

stock_options = {
    "📈 Apple (AAPL)": "AAPL",
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
interval = st.sidebar.selectbox("Interval", ["1d", "1h", "15m"])
period = st.sidebar.selectbox("Period", ["7d", "30d", "60d", "90d", "180d", "1y"])

if interval in ["1h", "15m"] and period not in ["7d", "30d", "60d"]:
    period = "60d"

@st.cache_data(ttl=300)
def load_data(ticker, period, interval):
    try:
        df = yf.download(ticker, period=period, interval=interval)
        if df.empty:
            return None
        df.reset_index(inplace=True)
        return df
    except:
        return None

df = load_data(ticker, period, interval)

if df is None:
    st.error("❌ Data fetch failed. Try again later.")
    st.stop()

df["sma_20"] = df["Close"].rolling(20).mean()
df["ema_12"] = df["Close"].ewm(span=12, adjust=False).mean()
df["rsi"] = ta.momentum.RSIIndicator(df["Close"]).rsi()

tab1, tab2, tab3, tab4 = st.tabs(["🏢 Overview", "📊 Technicals", "🤖 AI Insights", "📈 Backtest"])

# --- OVERVIEW ---
with tab1:
    st.subheader(f"🏢 {ticker}")

    current_price = df["Close"].iloc[-1]
    prev_price = df["Close"].iloc[-2]

    change = current_price - prev_price
    change_pct = (change / prev_price) * 100

    col1, col2, col3 = st.columns(3)

    col1.metric("Price", f"${current_price:.2f}", f"{change_pct:.2f}%")
    col2.metric("Volume", f"{int(df['Volume'].iloc[-1]):,}")

    trend = "Bullish" if df["ema_12"].iloc[-1] > df["sma_20"].iloc[-1] else "Bearish"
    col3.metric("Trend", trend)

    st.divider()

    if trend == "Bullish":
        st.success("Momentum is positive")
    else:
        st.error("Momentum is weak")

    rsi = df["rsi"].iloc[-1]
    if rsi > 70:
        st.warning("Overbought")
    elif rsi < 30:
        st.warning("Oversold")
    else:
        st.info("RSI neutral")

# --- TECHNICALS ---
with tab2:
    fig = go.Figure()

    fig.add_trace(go.Candlestick(
        x=df["Date"],
        open=df["Open"],
        high=df["High"],
        low=df["Low"],
        close=df["Close"]
    ))

    fig.add_trace(go.Scatter(x=df["Date"], y=df["sma_20"], name="SMA"))
    fig.add_trace(go.Scatter(x=df["Date"], y=df["ema_12"], name="EMA"))

    st.plotly_chart(fig, use_container_width=True)

# --- AI ---
with tab3:
    ema = df["ema_12"].iloc[-1]
    sma = df["sma_20"].iloc[-1]

    if ema > sma:
        st.success("AI Signal: BUY")
    else:
        st.error("AI Signal: SELL")

# --- BACKTEST ---
with tab4:
    balance = 10000
    position = 0
    entry = 0

    for i in range(1, len(df)):
        price = df.loc[i, "Close"]
        ema = df.loc[i, "ema_12"]
        sma = df.loc[i, "sma_20"]

        if ema > sma and position == 0:
            entry = price
            position = 1

        elif ema < sma and position == 1:
            balance += price - entry
            position = 0

    st.metric("Final Balance", f"${balance:.2f}")