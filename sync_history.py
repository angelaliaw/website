import pandas as pd
import yfinance as yf
import json
from datetime import datetime
import os

# Configuration
STOCKS_CSV = 'data/stocks.csv'
HISTORY_FILE = 'data/history.json'

def get_yahoo_symbol(code):
    """Convert CSV code to Yahoo Finance symbol with leading zeros fix."""
    code_str = str(code).strip()
    if code_str.isdigit():
        if len(code_str) <= 4:
            code_str = code_str.zfill(4)
        return f"{code_str}.TW"
    return code_str

def sync_data():
    print("🚀 Starting Advanced Quantum Stock Sync...")
    
    if not os.path.exists(STOCKS_CSV):
        print(f"❌ Error: {STOCKS_CSV} not found.")
        return

    # 1. Read the user's portfolio
    df = pd.read_csv(STOCKS_CSV)
    codes = df['code'].unique().tolist()
    
    # 2. Add market indices & macro
    indices = ['^NDX', '^GSPC', '^VIX', '^TWII', 'TWD=X', 'NVDA', 'TSM', 'DX-Y.NYB', '^TNX']
    symbols = [get_yahoo_symbol(c) for c in codes] + indices
    
    # 3. Fetch live data
    print(f"📡 Fetching extended data for {len(symbols)} symbols...")
    
    latest_records = {}
    timestamp = datetime.now().isoformat()
    
    # Using Tickers for more detailed info
    for symbol in symbols:
        try:
            t = yf.Ticker(symbol)
            # Use fast_info or history for quick data
            hist = t.history(period='2d')
            if not hist.empty:
                latest = hist.iloc[-1]
                prev = hist.iloc[-2] if len(hist) > 1 else latest
                
                latest_records[symbol] = {
                    'price': float(latest['Close']),
                    'open': float(latest['Open']),
                    'high': float(latest['High']),
                    'low': float(latest['Low']),
                    'prev_close': float(prev['Close']),
                    'volume': int(latest['Volume']),
                    'value_m': float((latest['Volume'] * latest['Close']) / 1000000),
                    'timestamp': timestamp,
                    # Fundamental data (if available)
                    'pe': t.info.get('trailingPE', 0),
                    'market_cap': t.info.get('marketCap', 0),
                    'eps': t.info.get('trailingEps', 0)
                }
        except Exception as e:
            print(f"⚠️ Could not fetch {symbol}: {e}")

    # 4. Save to history
    history = {}
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r') as f:
                history = json.load(f)
        except:
            history = {}
    
    # Append current snapshot
    day_key = datetime.now().strftime('%Y-%m-%d %H:%M')
    history[day_key] = latest_records
    
    # Limit history size to keep file manageable (e.g., last 100 runs)
    if len(history) > 100:
        oldest_key = sorted(history.keys())[0]
        del history[oldest_key]
        
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=4)
    
    print(f"✅ Success! Recorded detailed data to {HISTORY_FILE}")

if __name__ == "__main__":
    sync_data()
