import pandas as pd
import yfinance as yf
import json
from datetime import datetime
import os

# Configuration
STOCKS_CSV = 'data/stocks.csv'
HISTORY_FILE = 'data/history.json'

def get_yahoo_symbol(code):
    """Convert CSV code to Yahoo Finance symbol."""
    if code.isdigit() or (len(code) == 6 and code[:5].isdigit()):
        return f"{code}.TW"
    return code

def sync_data():
    print("🚀 Starting Quantum Stock Sync...")
    
    if not os.path.exists(STOCKS_CSV):
        print(f"❌ Error: {STOCKS_CSV} not found.")
        return

    # 1. Read the user's portfolio
    df = pd.read_csv(STOCKS_CSV)
    codes = df['code'].unique().tolist()
    
    # 2. Add market indices
    indices = ['^NDX', '^GSPC', '^VIX', '^TWII', 'TWD=X', 'NVDA', 'TSM']
    symbols = [get_yahoo_symbol(str(c)) for c in codes] + indices
    
    # 3. Fetch live data
    print(f"📡 Fetching data for {len(symbols)} symbols...")
    data = yf.download(symbols, period='1d', interval='1m', progress=False)
    
    latest_records = {}
    timestamp = datetime.now().isoformat()
    
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.history(period='1d')
            if not info.empty:
                latest = info.iloc[-1]
                latest_records[symbol] = {
                    'price': float(latest['Close']),
                    'high': float(latest['High']),
                    'low': float(latest['Low']),
                    'volume': int(latest['Volume']),
                    'timestamp': timestamp
                }
        except Exception as e:
            print(f"⚠️ Could not fetch {symbol}: {e}")

    # 4. Save to history
    history = {}
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, 'r') as f:
            history = json.load(f)
    
    # Append current snapshot to history
    day_key = datetime.now().strftime('%Y-%m-%d')
    history[day_key] = latest_records
    
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=4)
    
    print(f"✅ Success! Recorded {len(latest_records)} assets to {HISTORY_FILE}")
    print(f"📅 Record Date: {day_key}")

if __name__ == "__main__":
    sync_data()
