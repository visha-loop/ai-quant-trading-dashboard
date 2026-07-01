from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
import ta
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("quant_api")

app = FastAPI(title="Quant AI Terminal API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/analyze")
def analyze_asset(
    ticker: str = "AAPL",
    period: str = "30d",
    interval: str = "1d",
    short_window: int = Query(12, ge=2, le=50),
    long_window: int = Query(20, ge=5, le=200),
    initial_capital: float = Query(10000.0, ge=100.0)
):
    logger.info(f"Analyzing asset: {ticker}, period: {period}, interval: {interval}")
    
    # 1. Determine safe download period to get enough history for indicators
    download_period = period
    if interval == "1d":
        download_period = "1y"
    elif interval in ["1h", "15m"]:
        download_period = "60d"
        
    # 2. Download from yfinance
    df = yf.download(ticker, period=download_period, interval=interval)
    if df.empty:
        return {"error": "No data found for this asset."}
        
    # Flatten columns if multi-indexed
    df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]
    df = df.dropna()
    
    if len(df) < 5:
        return {"error": "Insufficient historical data returned."}
        
    # 3. Fetch Company Info
    company_info = {}
    try:
        t = yf.Ticker(ticker)
        company_info = {
            "longName": t.info.get("longName", ticker),
            "marketCap": t.info.get("marketCap", "N/A"),
            "sector": t.info.get("sector", "N/A"),
            "country": t.info.get("country", "N/A"),
            "longBusinessSummary": t.info.get("longBusinessSummary", "No company summary available.")
        }
    except Exception as e:
        logger.warning(f"Error fetching ticker info: {e}")
        company_info = {
            "longName": ticker,
            "marketCap": "N/A",
            "sector": "N/A",
            "country": "N/A",
            "longBusinessSummary": "No company summary available."
        }

    # 4. Calculate indicators on full dataset
    close = df["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
        
    df["sma_20"] = close.rolling(20).mean()
    df["ema_12"] = close.ewm(span=12, adjust=False).mean()
    df["backtest_short"] = close.ewm(span=short_window, adjust=False).mean()
    df["backtest_long"] = close.rolling(long_window).mean()
    df["rsi"] = ta.momentum.RSIIndicator(close).rsi()
    
    bollinger = ta.volatility.BollingerBands(close)
    df["bb_high"] = bollinger.bollinger_hband()
    df["bb_low"] = bollinger.bollinger_lband()
    df["bb_mid"] = bollinger.bollinger_mavg()
    
    macd = ta.trend.MACD(close)
    df["macd"] = macd.macd()
    df["macd_signal"] = macd.macd_signal()
    df["macd_hist"] = df["macd"] - df["macd_signal"]
    
    df["momentum_5d"] = df["Close"] / df["Close"].shift(5)
    df["momentum_10d"] = df["Close"] / df["Close"].shift(10)
    
    df["returns"] = df["Close"].pct_change()
    df["volatility"] = df["returns"].rolling(10).std()
    df["volume_ma"] = df["Volume"].rolling(10).mean()
    
    # Calculate rolling volatilities for 3D term structure surface
    vol_windows = [5, 10, 15, 20, 25, 30]
    for w in vol_windows:
        df[f"vol_term_{w}"] = df["returns"].rolling(w).std() * np.sqrt(252) * 100
        
    # Tomorrow's target
    df["target"] = (df["Close"].shift(-1) > df["Close"]).astype(int)
    
    # Create the training dataset (before display slicing)
    df_ml = df.dropna().copy()
    
    # 5. Train ML Model
    ml_result = {"hasEnoughData": False}
    features = [
        "rsi", "macd", "macd_signal", "sma_20", "ema_12", 
        "volatility", "volume_ma", "momentum_5d", "momentum_10d"
    ]
    
    if len(df_ml) >= 10:
        try:
            X = df_ml[features]
            y = df_ml["target"]
            
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, shuffle=False
            )
            
            latest_features = X.iloc[[-1]]
            
            # 1. Random Forest
            rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
            rf_model.fit(X_train, y_train)
            rf_preds = rf_model.predict(X_test)
            rf_acc = accuracy_score(y_test, rf_preds)
            rf_importance = [
                {"feature": f, "importance": float(imp)} 
                for f, imp in zip(features, rf_model.feature_importances_)
            ]
            rf_importance = sorted(rf_importance, key=lambda k: k["importance"], reverse=True)
            rf_pred_tomorrow = int(rf_model.predict(latest_features)[0])
            rf_prob = float(rf_model.predict_proba(latest_features)[0].max())

            # 2. Logistic Regression
            lr_model = LogisticRegression(max_iter=1000, random_state=42)
            lr_model.fit(X_train, y_train)
            lr_preds = lr_model.predict(X_test)
            lr_acc = accuracy_score(y_test, lr_preds)
            lr_coefs = np.abs(lr_model.coef_[0])
            lr_coefs_sum = np.sum(lr_coefs)
            lr_importance_normalized = lr_coefs / lr_coefs_sum if lr_coefs_sum > 0 else lr_coefs
            lr_importance = [
                {"feature": f, "importance": float(imp)} 
                for f, imp in zip(features, lr_importance_normalized)
            ]
            lr_importance = sorted(lr_importance, key=lambda k: k["importance"], reverse=True)
            lr_pred_tomorrow = int(lr_model.predict(latest_features)[0])
            lr_prob = float(lr_model.predict_proba(latest_features)[0].max())

            # 3. Gradient Boosting
            gb_model = GradientBoostingClassifier(random_state=42)
            gb_model.fit(X_train, y_train)
            gb_preds = gb_model.predict(X_test)
            gb_acc = accuracy_score(y_test, gb_preds)
            gb_importance = [
                {"feature": f, "importance": float(imp)} 
                for f, imp in zip(features, gb_model.feature_importances_)
            ]
            gb_importance = sorted(gb_importance, key=lambda k: k["importance"], reverse=True)
            gb_pred_tomorrow = int(gb_model.predict(latest_features)[0])
            gb_prob = float(gb_model.predict_proba(latest_features)[0].max())

            ml_result = {
                "hasEnoughData": True,
                "comparison": [
                    {
                        "modelName": "Random Forest",
                        "accuracy": round(float(rf_acc) * 100, 2),
                        "prediction": "UP" if rf_pred_tomorrow == 1 else "DOWN",
                        "probability": round(rf_prob * 100, 2),
                        "featureImportance": rf_importance
                    },
                    {
                        "modelName": "Logistic Regression",
                        "accuracy": round(float(lr_acc) * 100, 2),
                        "prediction": "UP" if lr_pred_tomorrow == 1 else "DOWN",
                        "probability": round(lr_prob * 100, 2),
                        "featureImportance": lr_importance
                    },
                    {
                        "modelName": "Gradient Boosting",
                        "accuracy": round(float(gb_acc) * 100, 2),
                        "prediction": "UP" if gb_pred_tomorrow == 1 else "DOWN",
                        "probability": round(gb_prob * 100, 2),
                        "featureImportance": gb_importance
                    }
                ]
            }
        except Exception as e:
            logger.error(f"Error training ML model: {e}")
            ml_result = {"hasEnoughData": False, "error": str(e)}

    # 6. Slice df to requested period for display
    if period.endswith("d"):
        days = int(period[:-1])
        cutoff_date = df.index[-1] - pd.Timedelta(days=days)
    elif period.endswith("y"):
        years = int(period[:-1])
        cutoff_date = df.index[-1] - pd.DateOffset(years=years)
    else:
        cutoff_date = df.index[0]
        
    df_disp = df.loc[df.index >= cutoff_date]
    if df_disp.empty:
        df_disp = df.tail(10) # Fallback

    # 7. Compute Overview Metrics (on last available day)
    latest_row = df_disp.iloc[-1]
    latest_close = float(latest_row["Close"])
    prev_close = float(df_disp.iloc[-2]["Close"]) if len(df_disp) > 1 else latest_close
    change_val = latest_close - prev_close
    change_pct = (change_val / prev_close) * 100 if prev_close != 0 else 0
    
    rsi_val = float(latest_row["rsi"]) if not pd.isna(latest_row["rsi"]) else 50.0
    macd_val = float(latest_row["macd"]) if not pd.isna(latest_row["macd"]) else 0.0
    macd_sig = float(latest_row["macd_signal"]) if not pd.isna(latest_row["macd_signal"]) else 0.0
    
    trend = "Bullish" if macd_val > macd_sig else "Bearish"
    signal = "BUY" if rsi_val < 70 and macd_val > macd_sig else "HOLD"
    if rsi_val > 70 and macd_val < macd_sig:
        signal = "SELL"
        
    overview = {
        "price": round(latest_close, 2),
        "changeValue": round(change_val, 2),
        "changePercent": round(change_pct, 2),
        "rsi": round(rsi_val, 2),
        "macd": round(macd_val, 2),
        "macdSignal": round(macd_sig, 2),
        "trend": trend,
        "signal": signal
    }
    
    # 8. Compute Backtest (on full historical period to ensure data points)
    df_bt = df.dropna(subset=["backtest_short", "backtest_long"])
    
    balance = initial_capital
    position = 0
    shares = 0
    entry_price = 0.0
    
    trades_log = []
    equity_curve = []
    
    for i in range(len(df_bt)):
        date_str = df_bt.index[i].strftime("%Y-%m-%d")
        price = float(df_bt["Close"].iloc[i])
        short_val = float(df_bt["backtest_short"].iloc[i])
        long_val = float(df_bt["backtest_long"].iloc[i])
        
        if i > 0:
            prev_short = float(df_bt["backtest_short"].iloc[i-1])
            prev_long = float(df_bt["backtest_long"].iloc[i-1])
            
            # Crossover BUY: short crossed above long
            if prev_short <= prev_long and short_val > long_val and shares == 0:
                shares = int(balance // price)
                if shares > 0:
                    cost = shares * price
                    balance -= cost
                    entry_price = price
                    trades_log.append({
                        "date": date_str,
                        "action": "BUY",
                        "price": round(price, 2),
                        "shares": shares,
                        "profit": 0.0,
                        "balance": round(balance + (shares * price), 2)
                    })
            
            # Crossover SELL: short crossed below long
            elif prev_short >= prev_long and short_val < long_val and shares > 0:
                revenue = shares * price
                balance += revenue
                profit_loss = (price - entry_price) * shares
                trades_log.append({
                    "date": date_str,
                    "action": "SELL",
                    "price": round(price, 2),
                    "shares": shares,
                    "profit": round(profit_loss, 2),
                    "balance": round(balance, 2)
                })
                shares = 0
                entry_price = 0.0
                
        # Record portfolio equity
        current_equity = balance + (shares * price)
        equity_curve.append({
            "date": date_str,
            "equity": round(current_equity, 2)
        })

    # Liquidate at end if holding
    final_balance = balance
    if shares > 0:
        final_price = float(df_bt["Close"].iloc[-1])
        final_balance += shares * final_price
        profit_loss = (final_price - entry_price) * shares
        trades_log.append({
            "date": df_bt.index[-1].strftime("%Y-%m-%d"),
            "action": "LIQUIDATE",
            "price": round(final_price, 2),
            "shares": shares,
            "profit": round(profit_loss, 2),
            "balance": round(final_balance, 2)
        })

    # Calculate statistics
    completed_trades = [t for t in trades_log if t["action"] in ["SELL", "LIQUIDATE"]]
    total_trades_count = len(completed_trades)
    winning_trades = [t for t in completed_trades if t["profit"] > 0]
    winning_trades_count = len(winning_trades)
    win_rate = (winning_trades_count / total_trades_count * 100) if total_trades_count > 0 else 0.0
    
    gross_profits = sum([t["profit"] for t in completed_trades if t["profit"] > 0])
    gross_losses = sum([abs(t["profit"]) for t in completed_trades if t["profit"] < 0])
    profit_factor = (gross_profits / gross_losses) if gross_losses > 0 else (gross_profits if gross_profits > 0 else 1.0)
    
    # Max Drawdown
    equity_values = [e["equity"] for e in equity_curve]
    peak = equity_values[0] if equity_values else initial_capital
    max_drawdown = 0.0
    for val in equity_values:
        if val > peak:
            peak = val
        drawdown = (peak - val) / peak * 100 if peak > 0 else 0.0
        if drawdown > max_drawdown:
            max_drawdown = drawdown

    backtest = {
        "initialBalance": round(initial_capital, 2),
        "finalBalance": round(final_balance, 2),
        "returnPercent": round(((final_balance - initial_capital) / initial_capital) * 100, 2),
        "totalTrades": total_trades_count,
        "winningTrades": winning_trades_count,
        "winRate": round(win_rate, 2),
        "profitFactor": round(profit_factor, 2),
        "maxDrawdown": round(max_drawdown, 2),
        "tradesLog": trades_log,
        "equityCurve": equity_curve
    }

    # 9. Format Historical Data points for JSON serialization
    historical_points = []
    # Drop rows that are fully NaN in display df
    df_disp_clean = df_disp.replace({np.nan: None})
    
    for idx, row in df_disp_clean.iterrows():
        point = {
            "date": idx.strftime("%Y-%m-%d %H:%M" if interval != "1d" else "%Y-%m-%d"),
            "open": float(row["Open"]) if row["Open"] is not None else None,
            "high": float(row["High"]) if row["High"] is not None else None,
            "low": float(row["Low"]) if row["Low"] is not None else None,
            "close": float(row["Close"]) if row["Close"] is not None else None,
            "volume": int(row["Volume"]) if row["Volume"] is not None else None,
            "sma_20": float(row["sma_20"]) if row["sma_20"] is not None else None,
            "ema_12": float(row["ema_12"]) if row["ema_12"] is not None else None,
            "rsi": float(row["rsi"]) if row["rsi"] is not None else None,
            "macd": float(row["macd"]) if row["macd"] is not None else None,
            "macd_signal": float(row["macd_signal"]) if row["macd_signal"] is not None else None,
            "macd_hist": float(row["macd_hist"]) if row["macd_hist"] is not None else None,
            "bb_high": float(row["bb_high"]) if row["bb_high"] is not None else None,
            "bb_low": float(row["bb_low"]) if row["bb_low"] is not None else None,
            "bb_mid": float(row["bb_mid"]) if row["bb_mid"] is not None else None
        }
        # Add term volatility columns
        for w in vol_windows:
            col_name = f"vol_term_{w}"
            point[col_name] = float(row[col_name]) if row[col_name] is not None else None
            
        historical_points.append(point)
        
    # Format ML dataset points for the 3D scatter
    ml_points = []
    df_ml_clean = df_ml.replace({np.nan: None})
    for idx, row in df_ml_clean.iterrows():
        ml_points.append({
            "date": idx.strftime("%Y-%m-%d"),
            "returns": float(row["returns"]) if row["returns"] is not None else None,
            "volatility": float(row["volatility"]) if row["volatility"] is not None else None,
            "rsi": float(row["rsi"]) if row["rsi"] is not None else None,
            "target": int(row["target"]) if row["target"] is not None else None
        })

    return {
        "ticker": ticker,
        "company": company_info,
        "overview": overview,
        "backtest": backtest,
        "ml": ml_result,
        "historical": historical_points,
        "mlPoints": ml_points
    }
