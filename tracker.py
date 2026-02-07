import yfinance as yf
import pandas as pd

# The current 20 constituents of the BET Index (as of Feb 2026)
bet_tickers = [
    "SNP.RO", "TLV.RO", "H2O.RO", "SNG.RO", "BRD.RO", 
    "SNN.RO", "TGN.RO", "DIGI.RO", "EL.RO", "M.RO", 
    "TEL.RO", "PE.RO", "ONE.RO", "AQ.RO", "ATB.RO", 
    "TRP.RO", "FP.RO", "SFG.RO", "TTS.RO", "WINE.RO"
]

def get_bet_portfolio():
    data = []
    print(f"Fetching data for {len(bet_tickers)} stocks...")
    
    for symbol in bet_tickers:
        try:
            stock = yf.Ticker(symbol)
            info = stock.fast_info
            
            # Extract basic data
            data.append({
                "Ticker": symbol.replace(".RO", ""),
                "Price": round(info['last_price'], 4),
                "Currency": info['currency'],
                "Market Cap (m)": round(info['market_cap'] / 1_000_000, 2)
            })
        except:
            print(f"Could not fetch {symbol}")

    # Create a nice table
    df = pd.DataFrame(data)
    print("\n--- BET Index Constituents (Current Prices) ---")
    print(df.to_string(index=False))

if __name__ == "__main__":
    get_bet_portfolio()