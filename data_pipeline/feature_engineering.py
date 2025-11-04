import os
import pandas as pd
import yfinance as yf
import ta

def load_data(csv_path="apple_data.csv", symbol="AAPL"):
    # Prefer local CSV (created earlier). If not present, fetch via yfinance.
    if os.path.exists(csv_path):
        df = pd.read_csv(csv_path, parse_dates=["Date"])
        df.rename(columns={c: c.lower() for c in df.columns}, inplace=True)
    else:
        # fetch last 180 days
        df = yf.download(symbol, period="180d", interval="1d")
        df.reset_index(inplace=True)
        df.columns = [c.lower() for c in df.columns]
    return df

def add_indicators(df):
    # Ensure expected columns: date, open, high, low, close, volume
    df = df.copy().sort_values("date").reset_index(drop=True)

    # Simple Moving Average (SMA)
    df["sma_20"] = df["close"].rolling(window=20, min_periods=1).mean()
    df["sma_50"] = df["close"].rolling(window=50, min_periods=1).mean()

    # Exponential Moving Average (EMA)
    df["ema_12"] = df["close"].ewm(span=12, adjust=False).mean()
    df["ema_26"] = df["close"].ewm(span=26, adjust=False).mean()

    # MACD (using ta)
    macd = ta.trend.MACD(close=df["close"], window_slow=26, window_fast=12, window_sign=9)
    df["macd"] = macd.macd()
    df["macd_signal"] = macd.macd_signal()
    df["macd_hist"] = macd.macd_diff()

    # RSI (using ta)
    rsi = ta.momentum.RSIIndicator(close=df["close"], window=14)
    df["rsi_14"] = rsi.rsi()

    # Bollinger Bands
    bb = ta.volatility.BollingerBands(close=df["close"], window=20, window_dev=2)
    df["bb_h"] = bb.bollinger_hband()
    df["bb_l"] = bb.bollinger_lband()
    df["bb_m"] = bb.bollinger_mavg()

    # Drop rows with NaNs introduced by indicators (optional)
    df = df.dropna().reset_index(drop=True)
    return df

if __name__ == "__main__":
    df = load_data(csv_path="data_pipeline/apple_data.csv", symbol="AAPL")
    # If your earlier script saved apple_data.csv to Desktop root, try "apple_data.csv" instead.
    if df.empty:
        print("No data found. Try adjusting csv_path or check fetch_data.py output.")
    else:
        df_ind = add_indicators(df)
        # Save features
        out_path = "data_pipeline/features.csv"
        df_ind.to_csv(out_path, index=False)
        print(f"✅ Features saved to {out_path}")
        print(df_ind.head().to_string(index=False))
