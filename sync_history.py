import os
import sys
import ssl

def install_dependencies():
    required = ["yfinance", "pandas", "pymongo[srv]", "certifi"]
    for package in required:
        try:
            if "[" in package:
                __import__("pymongo")
            else:
                __import__(package.split('[')[0])
        except ImportError:
            print(f"📦 Installing missing library: {package}...")
            os.system(f"{sys.executable} -m pip install {package}")

# Run installer before imports
install_dependencies()

import pandas as pd
import yfinance as yf
import json
from datetime import datetime
from pymongo import MongoClient
import certifi

# --- CONFIGURATION ---
MONGO_URI = "mongodb+srv://angelaliaw:MpiFMrhzm3nmVzZZ@cluster0.zwknzmp.mongodb.net/?appName=Cluster0"
DB_NAME = "StockDB"
COLLECTION_NAME = "History"
STOCKS_CSV = 'data/stocks.csv'
# ---------------------

def get_yahoo_symbols_to_try(code):
    """Generate potential Yahoo symbols for a given code to handle Taiwan's inconsistent padding."""
    code_str = str(code).strip()
    if not code_str.isdigit():
        return [code_str]
    
    # Taiwan stocks are usually 4 digits, ETFs can be 4, 5, or 6.
    # We will return the most likely candidates
    if len(code_str) <= 4:
        # e.g. 50 -> 0050, 2330 -> 2330, 878 -> 00878 or 000878
        candidates = [
            f"{code_str.zfill(4)}.TW",
            f"{code_str.zfill(5)}.TW",
            f"{code_str.zfill(6)}.TW"
        ]
        return list(dict.fromkeys(candidates)) # Remove duplicates
    return [f"{code_str}.TW"]

def sync_data():
    print("🚀 Starting Master Quantum Stock Sync to MongoDB...")
    
    if not os.path.exists(STOCKS_CSV):
        print(f"❌ Error: {STOCKS_CSV} not found.")
        return

    df = pd.read_csv(STOCKS_CSV)
    codes = df['code'].dropna().unique().tolist()
    
    indices = ['^NDX', '^GSPC', '^VIX', '^TWII', 'TWD=X', 'NVDA', 'TSM', 'DX-Y.NYB', '^TNX']
    
    latest_records = {}
    timestamp = datetime.now()
    
    # Process portfolio stocks with retry logic for padding
    for code in codes:
        symbol_candidates = get_yahoo_symbols_to_try(code)
        success = False
        for symbol in symbol_candidates:
            try:
                t = yf.Ticker(symbol)
                hist = t.history(period='1d')
                if not hist.empty:
                    latest = hist.iloc[-1]
                    clean_symbol = symbol.replace('.', '_').replace('^', '')
                    latest_records[clean_symbol] = {
                        'price': float(latest['Close']),
                        'open': float(latest['Open']),
                        'high': float(latest['High']),
                        'low': float(latest['Low']),
                        'volume': int(latest['Volume']),
                        'name_in_csv': str(code)
                    }
                    print(f"✅ Fetched: {symbol}")
                    success = True
                    break # Stop trying candidates for this code
            except:
                continue
        if not success:
            print(f"⚠️ Could not find data for CSV code: {code} (Checked: {symbol_candidates})")

    # Process Indices (always work with ^)
    for symbol in indices:
        try:
            t = yf.Ticker(symbol)
            hist = t.history(period='1d')
            if not hist.empty:
                latest = hist.iloc[-1]
                clean_key = symbol.replace('.', '_').replace('^', '')
                latest_records[clean_key] = {
                    'price': float(latest['Close']),
                    'open': float(latest['Open']),
                    'high': float(latest['High']),
                    'low': float(latest['Low']),
                    'volume': int(latest['Volume']),
                }
                print(f"✅ Fetched: {symbol}")
        except:
            print(f"⚠️ Failed index: {symbol}")

    try:
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client[DB_NAME]
        col = db[COLLECTION_NAME]
        
        document = {
            "timestamp": timestamp,
            "data": latest_records,
            "summary": f"Recorded {len(latest_records)} assets"
        }
        
        result = col.insert_one(document)
        print(f"\n✨ SUCCESS! {len(latest_records)} assets recorded to MongoDB.")
        print(f"🆔 Document ID: {result.inserted_id}")
        client.close()
    except Exception as e:
        print(f"❌ MongoDB Upload Failed: {e}")

if __name__ == "__main__":
    sync_data()
