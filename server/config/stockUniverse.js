// Curated NSE universe mapped to our sector categories — the stocks equivalent
// of config/newsFeeds.js, and it exists for the same reason: the fetcher should
// describe *how* to pull data, not *what* to pull.
//
// Why this is a list here rather than something discovered at runtime: there is
// no keyless endpoint that will hand us NSE constituents. Yahoo's predefined
// screener ignores `region=IN` and answers with US equities, and NSE's own API
// needs a cookie handshake it refuses to complete from a datacenter IP. So the
// universe is curated, exactly as the RSS feed list is, and the dynamism lives
// downstream — prices, ranges and signals all move on every refresh.
//
// `symbol` is what Yahoo wants (.NS suffix); `label` is what the card shows.
// `name` and `sector` are hand-written because the chart endpoint's metadata
// block does not carry usable display names.
//
// Adding a stock: add a line. The refresher picks it up on the next run, and
// quotes for symbols removed from here are pruned automatically.
module.exports = [
  // ── IT services ────────────────────────────────────────────────────────────
  { symbol: 'TCS.NS',        label: 'TCS',        name: 'Tata Consultancy Services', sector: 'it' },
  { symbol: 'INFY.NS',       label: 'INFY',       name: 'Infosys',                   sector: 'it' },
  { symbol: 'WIPRO.NS',      label: 'WIPRO',      name: 'Wipro',                     sector: 'it' },
  { symbol: 'HCLTECH.NS',    label: 'HCLTECH',    name: 'HCL Technologies',          sector: 'it' },
  { symbol: 'TECHM.NS',      label: 'TECHM',      name: 'Tech Mahindra',             sector: 'it' },
  // LTIM.NS 404s on the chart endpoint under every variant tried (LTIM,
  // LTIMINDTREE, MINDTREE), so LTIMindtree is not covered here.
  { symbol: 'PERSISTENT.NS', label: 'PERSISTENT', name: 'Persistent Systems',        sector: 'it' },
  { symbol: 'COFORGE.NS',    label: 'COFORGE',    name: 'Coforge',                   sector: 'it' },
  { symbol: 'MPHASIS.NS',    label: 'MPHASIS',    name: 'Mphasis',                   sector: 'it' },

  // ── Banking & financial services ───────────────────────────────────────────
  { symbol: 'HDFCBANK.NS',   label: 'HDFCBANK',   name: 'HDFC Bank',                 sector: 'banking' },
  { symbol: 'ICICIBANK.NS',  label: 'ICICIBANK',  name: 'ICICI Bank',                sector: 'banking' },
  { symbol: 'SBIN.NS',       label: 'SBIN',       name: 'State Bank of India',       sector: 'banking' },
  { symbol: 'KOTAKBANK.NS',  label: 'KOTAKBANK',  name: 'Kotak Mahindra Bank',       sector: 'banking' },
  { symbol: 'AXISBANK.NS',   label: 'AXISBANK',   name: 'Axis Bank',                 sector: 'banking' },
  { symbol: 'INDUSINDBK.NS', label: 'INDUSINDBK', name: 'IndusInd Bank',             sector: 'banking' },
  { symbol: 'BAJFINANCE.NS', label: 'BAJFINANCE', name: 'Bajaj Finance',             sector: 'banking' },
  { symbol: 'SBILIFE.NS',    label: 'SBILIFE',    name: 'SBI Life Insurance',        sector: 'banking' },
  { symbol: 'HDFCLIFE.NS',   label: 'HDFCLIFE',   name: 'HDFC Life Insurance',       sector: 'banking' },

  // ── FMCG & consumer ────────────────────────────────────────────────────────
  { symbol: 'ITC.NS',        label: 'ITC',        name: 'ITC',                       sector: 'fmcg' },
  { symbol: 'HINDUNILVR.NS', label: 'HINDUNILVR', name: 'Hindustan Unilever',        sector: 'fmcg' },
  { symbol: 'NESTLEIND.NS',  label: 'NESTLEIND',  name: 'Nestle India',              sector: 'fmcg' },
  { symbol: 'BRITANNIA.NS',  label: 'BRITANNIA',  name: 'Britannia Industries',      sector: 'fmcg' },
  { symbol: 'DABUR.NS',      label: 'DABUR',      name: 'Dabur India',               sector: 'fmcg' },
  { symbol: 'TATACONSUM.NS', label: 'TATACONSUM', name: 'Tata Consumer Products',    sector: 'fmcg' },

  // ── Automobiles ────────────────────────────────────────────────────────────
  { symbol: 'MARUTI.NS',     label: 'MARUTI',     name: 'Maruti Suzuki',             sector: 'auto' },
  // Tata Motors has demerged: TATAMOTORS.NS is dead, and the business now
  // trades as two separate listings — commercial and passenger vehicles.
  { symbol: 'TMCV.NS',       label: 'TMCV',       name: 'Tata Motors (Commercial)',  sector: 'auto' },
  { symbol: 'TMPV.NS',       label: 'TMPV',       name: 'Tata Motors (Passenger)',   sector: 'auto' },
  { symbol: 'M&M.NS',        label: 'M&M',        name: 'Mahindra & Mahindra',       sector: 'auto' },
  { symbol: 'BAJAJ-AUTO.NS', label: 'BAJAJ-AUTO', name: 'Bajaj Auto',                sector: 'auto' },
  { symbol: 'EICHERMOT.NS',  label: 'EICHERMOT',  name: 'Eicher Motors',             sector: 'auto' },
  { symbol: 'HEROMOTOCO.NS', label: 'HEROMOTOCO', name: 'Hero MotoCorp',             sector: 'auto' },

  // ── Energy & utilities ─────────────────────────────────────────────────────
  { symbol: 'RELIANCE.NS',   label: 'RELIANCE',   name: 'Reliance Industries',       sector: 'energy' },
  { symbol: 'ONGC.NS',       label: 'ONGC',       name: 'Oil & Natural Gas Corp',    sector: 'energy' },
  { symbol: 'NTPC.NS',       label: 'NTPC',       name: 'NTPC',                      sector: 'energy' },
  { symbol: 'POWERGRID.NS',  label: 'POWERGRID',  name: 'Power Grid Corporation',    sector: 'energy' },
  { symbol: 'BPCL.NS',       label: 'BPCL',       name: 'Bharat Petroleum',          sector: 'energy' },
  { symbol: 'COALINDIA.NS',  label: 'COALINDIA',  name: 'Coal India',                sector: 'energy' },

  // ── Pharma & healthcare ────────────────────────────────────────────────────
  { symbol: 'SUNPHARMA.NS',  label: 'SUNPHARMA',  name: 'Sun Pharmaceutical',        sector: 'pharma' },
  { symbol: 'CIPLA.NS',      label: 'CIPLA',      name: 'Cipla',                     sector: 'pharma' },
  { symbol: 'DRREDDY.NS',    label: 'DRREDDY',    name: "Dr. Reddy's Laboratories",  sector: 'pharma' },
  { symbol: 'DIVISLAB.NS',   label: 'DIVISLAB',   name: "Divi's Laboratories",       sector: 'pharma' },
  { symbol: 'APOLLOHOSP.NS', label: 'APOLLOHOSP', name: 'Apollo Hospitals',          sector: 'pharma' },

  // ── Industrials, materials & infrastructure ────────────────────────────────
  { symbol: 'LT.NS',         label: 'LT',         name: 'Larsen & Toubro',           sector: 'industrials' },
  { symbol: 'ULTRACEMCO.NS', label: 'ULTRACEMCO', name: 'UltraTech Cement',          sector: 'industrials' },
  { symbol: 'GRASIM.NS',     label: 'GRASIM',     name: 'Grasim Industries',         sector: 'industrials' },
  { symbol: 'TATASTEEL.NS',  label: 'TATASTEEL',  name: 'Tata Steel',                sector: 'industrials' },
  { symbol: 'JSWSTEEL.NS',   label: 'JSWSTEEL',   name: 'JSW Steel',                 sector: 'industrials' },
  { symbol: 'HINDALCO.NS',   label: 'HINDALCO',   name: 'Hindalco Industries',       sector: 'industrials' },
  { symbol: 'ADANIPORTS.NS', label: 'ADANIPORTS', name: 'Adani Ports & SEZ',         sector: 'industrials' },

  // ── Telecom ────────────────────────────────────────────────────────────────
  { symbol: 'BHARTIARTL.NS', label: 'BHARTIARTL', name: 'Bharti Airtel',             sector: 'telecom' },
  { symbol: 'IDEA.NS',       label: 'IDEA',       name: 'Vodafone Idea',             sector: 'telecom' },

  // ── Consumer discretionary & retail ────────────────────────────────────────
  { symbol: 'TITAN.NS',      label: 'TITAN',      name: 'Titan Company',             sector: 'consumer' },
  { symbol: 'ASIANPAINT.NS', label: 'ASIANPAINT', name: 'Asian Paints',              sector: 'consumer' },
  { symbol: 'TRENT.NS',      label: 'TRENT',      name: 'Trent',                     sector: 'consumer' },
  { symbol: 'DMART.NS',      label: 'DMART',      name: 'Avenue Supermarts',         sector: 'consumer' },
];
