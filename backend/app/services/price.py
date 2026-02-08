import time
import logging
from dataclasses import dataclass

import yfinance as yf

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 60

# Map common exchange abbreviations to yfinance suffixes.
# Users type the left side; yfinance expects the right side.
# Correct yfinance suffixes (e.g. .L, .DE, .PA) pass through unchanged.
_EXCHANGE_SUFFIX_MAP = {
    # UK / London Stock Exchange → .L
    ".UK": ".L",
    ".LSE": ".L",
    ".LON": ".L",
    # Germany / XETRA → .DE
    ".XETRA": ".DE",
    ".FRA": ".DE",
    ".ETR": ".DE",
    ".FRANKFURT": ".DE",
    # Bucharest (BVB) → .RO
    ".BVB": ".RO",
    ".BET": ".RO",
    # US exchanges → no suffix
    ".US": "",
    ".NYSE": "",
    ".NASDAQ": "",
    ".AMEX": "",
    # Euronext
    ".AMS": ".AS",       # Amsterdam → .AS
    ".BRU": ".BR",       # Brussels → .BR
    ".LIS": ".LS",       # Lisbon → .LS
    ".PARIS": ".PA",     # Paris → .PA
    # Italy
    ".MIL": ".MI",       # Milan → .MI
    # Spain
    ".MAD": ".MC",       # Madrid → .MC
    # Switzerland
    ".SIX": ".SW",       # SIX Swiss → .SW
    ".SWISS": ".SW",
    # Austria
    ".VIE": ".VI",       # Vienna → .VI
    # Canada
    ".TSX": ".TO",       # Toronto → .TO
    # Asia-Pacific
    ".TYO": ".T",        # Tokyo → .T
    ".HKG": ".HK",       # Hong Kong → .HK
    ".ASX": ".AX",       # Australia → .AX
}


def normalize_ticker(ticker: str) -> str:
    """Normalize ticker for yfinance compatibility.

    Maps common exchange abbreviations (e.g. .UK → .L for London)
    to the suffixes yfinance actually recognises.
    """
    upper = ticker.upper()
    for old_suffix, new_suffix in _EXCHANGE_SUFFIX_MAP.items():
        if upper.endswith(old_suffix):
            return upper[: -len(old_suffix)] + new_suffix
    return upper


@dataclass
class PriceResult:
    ticker: str
    price: float
    currency: str
    name: str | None = None


class PriceCache:
    """Simple in-memory TTL cache for price lookups."""

    def __init__(self, ttl: int = CACHE_TTL_SECONDS):
        self._ttl = ttl
        self._store: dict[str, tuple[float, PriceResult]] = {}  # ticker -> (timestamp, result)

    def get(self, ticker: str) -> PriceResult | None:
        entry = self._store.get(ticker)
        if entry and (time.monotonic() - entry[0]) < self._ttl:
            return entry[1]
        return None

    def set(self, ticker: str, result: PriceResult) -> None:
        self._store[ticker] = (time.monotonic(), result)

    def get_batch(self, tickers: list[str]) -> dict[str, PriceResult]:
        """Return cached results for tickers that are still fresh."""
        results = {}
        for t in tickers:
            cached = self.get(t)
            if cached:
                results[t] = cached
        return results


_cache = PriceCache()


def lookup_ticker(ticker: str) -> PriceResult:
    """Validate a single ticker and return its current price.

    Raises ValueError for invalid/unfetchable tickers.
    """
    ticker = normalize_ticker(ticker)
    cached = _cache.get(ticker)
    if cached:
        return cached

    try:
        stock = yf.Ticker(ticker)
        info = stock.fast_info
        price = info["last_price"]
        currency = info["currency"]
    except Exception as exc:
        raise ValueError(f"Could not fetch price for ticker '{ticker}'") from exc

    if price is None:
        raise ValueError(f"No price data available for ticker '{ticker}'")

    name = None
    try:
        name = stock.info.get("shortName") or stock.info.get("longName")
    except Exception:
        pass  # name is optional, don't fail on it

    result = PriceResult(ticker=ticker, price=round(price, 4), currency=currency, name=name)
    _cache.set(ticker, result)
    return result


def fetch_batch_prices(tickers: list[str]) -> dict[str, PriceResult]:
    """Fetch current prices for multiple tickers. Returns a dict of ticker -> PriceResult.

    Tickers that fail are logged and omitted from results.
    """
    if not tickers:
        return {}

    tickers = [normalize_ticker(t) for t in tickers]

    # Check cache first
    cached = _cache.get_batch(tickers)
    missing = [t for t in tickers if t not in cached]

    if not missing:
        return cached

    results = dict(cached)

    # Fetch missing tickers individually (yf.download returns price data
    # but not currency/name; individual Ticker calls are more reliable for
    # our use case and the batch is small for a personal portfolio)
    for ticker in missing:
        try:
            stock = yf.Ticker(ticker)
            info = stock.fast_info
            price = info["last_price"]
            currency = info["currency"]

            if price is None:
                logger.warning("No price data for %s, skipping", ticker)
                continue

            name = None
            try:
                name = stock.info.get("shortName") or stock.info.get("longName")
            except Exception:
                pass

            result = PriceResult(ticker=ticker, price=round(price, 4), currency=currency, name=name)
            _cache.set(ticker, result)
            results[ticker] = result
        except Exception:
            logger.warning("Failed to fetch price for %s, skipping", ticker, exc_info=True)

    return results
