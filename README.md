# vfinance

A Python tool that fetches live price and market cap data for all 20 constituents of the Bucharest Stock Exchange **BET Index** using Yahoo Finance.

## Usage

```bash
python tracker.py
```

## Requirements

- Python 3.8+
- [yfinance](https://pypi.org/project/yfinance/)
- [pandas](https://pypi.org/project/pandas/)

Install dependencies:

```bash
pip install yfinance pandas
```

## Output

Prints a table with the current price, currency, and market capitalization for each BET Index constituent:

| Ticker | Price | Currency | Market Cap (m) |
|--------|-------|----------|----------------|
| SNP    | ...   | RON      | ...            |
| TLV    | ...   | RON      | ...            |
| CNDX   | ...   | USD      | ...            |
