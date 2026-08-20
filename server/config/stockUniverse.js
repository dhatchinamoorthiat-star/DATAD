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
// Every symbol below was checked against the chart endpoint before being added
// — a 200 with a real regularMarketPrice. Ticker strings are the part of this
// file most likely to be wrong from memory, and a bad one costs a failed fetch
// on every cycle forever. LTIMindtree is still absent for exactly that reason:
// LTIM, LTIMINDTREE and MINDTREE all 404.
//
// Sized so the daily rotation on the Stocks page (utils/stocks.js) has real
// depth — at ~20 per sector a given stock resurfaces about monthly rather than
// every few days. Note the refresh cost scales with this list: one HTTP call
// per symbol at concurrency 6, so a full cycle is ~35s rather than the ~10s the
// original 54 took. The 1y range fetch is throttled to daily per symbol, which
// is what keeps that affordable.
//
// Adding a stock: add a line. The refresher picks it up on the next run, and
// quotes for symbols removed from here are pruned automatically.
module.exports = [
  // ── IT services ───────────────────────────────────────────────────────────────
  { symbol: 'HCLTECH.NS',    label: 'HCLTECH',    name: 'HCL Technologies',                sector: 'it' },
  { symbol: 'INFY.NS',       label: 'INFY',       name: 'Infosys',                         sector: 'it' },
  { symbol: 'TECHM.NS',      label: 'TECHM',      name: 'Tech Mahindra',                   sector: 'it' },
  { symbol: 'WIPRO.NS',      label: 'WIPRO',      name: 'Wipro',                           sector: 'it' },
  { symbol: 'TCS.NS',        label: 'TCS',        name: 'Tata Consultancy Services',       sector: 'it' },
  { symbol: 'PERSISTENT.NS', label: 'PERSISTENT', name: 'Persistent Systems',              sector: 'it' },
  { symbol: 'TATAELXSI.NS',  label: 'TATAELXSI',  name: 'Tata Elxsi',                      sector: 'it' },
  { symbol: 'LTTS.NS',       label: 'LTTS',       name: 'L&T Technology Services',         sector: 'it' },
  { symbol: 'COFORGE.NS',    label: 'COFORGE',    name: 'Coforge',                         sector: 'it' },
  { symbol: 'MPHASIS.NS',    label: 'MPHASIS',    name: 'Mphasis',                         sector: 'it' },
  { symbol: 'CYIENT.NS',     label: 'CYIENT',     name: 'Cyient',                          sector: 'it' },
  { symbol: 'KPITTECH.NS',   label: 'KPITTECH',   name: 'KPIT Technologies',               sector: 'it' },
  { symbol: 'OFSS.NS',       label: 'OFSS',       name: 'Oracle Financial Services',       sector: 'it' },
  { symbol: 'BSOFT.NS',      label: 'BSOFT',      name: 'Birlasoft',                       sector: 'it' },
  { symbol: 'INTELLECT.NS',  label: 'INTELLECT',  name: 'Intellect Design Arena',          sector: 'it' },
  { symbol: 'HAPPSTMNDS.NS', label: 'HAPPSTMNDS', name: 'Happiest Minds',                  sector: 'it' },
  { symbol: 'ECLERX.NS',     label: 'ECLERX',     name: 'eClerx Services',                 sector: 'it' },
  { symbol: 'MASTEK.NS',     label: 'MASTEK',     name: 'Mastek',                          sector: 'it' },
  { symbol: 'TANLA.NS',      label: 'TANLA',      name: 'Tanla Platforms',                 sector: 'it' },
  { symbol: 'ZENSARTECH.NS', label: 'ZENSARTECH', name: 'Zensar Technologies',             sector: 'it' },
  { symbol: 'SONATSOFTW.NS', label: 'SONATSOFTW', name: 'Sonata Software',                 sector: 'it' },

  // ── Banking & financial services ──────────────────────────────────────────────
  { symbol: 'HDFCBANK.NS',   label: 'HDFCBANK',   name: 'HDFC Bank',                       sector: 'banking' },
  { symbol: 'SBIN.NS',       label: 'SBIN',       name: 'State Bank of India',             sector: 'banking' },
  { symbol: 'KOTAKBANK.NS',  label: 'KOTAKBANK',  name: 'Kotak Mahindra Bank',             sector: 'banking' },
  { symbol: 'ICICIBANK.NS',  label: 'ICICIBANK',  name: 'ICICI Bank',                      sector: 'banking' },
  { symbol: 'AXISBANK.NS',   label: 'AXISBANK',   name: 'Axis Bank',                       sector: 'banking' },
  { symbol: 'INDUSINDBK.NS', label: 'INDUSINDBK', name: 'IndusInd Bank',                   sector: 'banking' },
  { symbol: 'HDFCLIFE.NS',   label: 'HDFCLIFE',   name: 'HDFC Life Insurance',             sector: 'banking' },
  { symbol: 'SBILIFE.NS',    label: 'SBILIFE',    name: 'SBI Life Insurance',              sector: 'banking' },
  { symbol: 'BAJAJFINSV.NS', label: 'BAJAJFINSV', name: 'Bajaj Finserv',                   sector: 'banking' },
  { symbol: 'ICICIGI.NS',    label: 'ICICIGI',    name: 'ICICI Lombard General Insurance', sector: 'banking' },
  { symbol: 'BAJFINANCE.NS', label: 'BAJFINANCE', name: 'Bajaj Finance',                   sector: 'banking' },
  { symbol: 'PNB.NS',        label: 'PNB',        name: 'Punjab National Bank',            sector: 'banking' },
  { symbol: 'BANKBARODA.NS', label: 'BANKBARODA', name: 'Bank of Baroda',                  sector: 'banking' },
  { symbol: 'CANBK.NS',      label: 'CANBK',      name: 'Canara Bank',                     sector: 'banking' },
  { symbol: 'UNIONBANK.NS',  label: 'UNIONBANK',  name: 'Union Bank of India',             sector: 'banking' },
  { symbol: 'IDFCFIRSTB.NS', label: 'IDFCFIRSTB', name: 'IDFC First Bank',                 sector: 'banking' },
  { symbol: 'BANDHANBNK.NS', label: 'BANDHANBNK', name: 'Bandhan Bank',                    sector: 'banking' },
  { symbol: 'FEDERALBNK.NS', label: 'FEDERALBNK', name: 'Federal Bank',                    sector: 'banking' },
  { symbol: 'RBLBANK.NS',    label: 'RBLBANK',    name: 'RBL Bank',                        sector: 'banking' },
  { symbol: 'INDIANB.NS',    label: 'INDIANB',    name: 'Indian Bank',                     sector: 'banking' },
  { symbol: 'ICICIPRULI.NS', label: 'ICICIPRULI', name: 'ICICI Prudential Life',           sector: 'banking' },
  { symbol: 'MUTHOOTFIN.NS', label: 'MUTHOOTFIN', name: 'Muthoot Finance',                 sector: 'banking' },
  { symbol: 'AUBANK.NS',     label: 'AUBANK',     name: 'AU Small Finance Bank',           sector: 'banking' },
  { symbol: 'CHOLAFIN.NS',   label: 'CHOLAFIN',   name: 'Cholamandalam Investment',        sector: 'banking' },
  { symbol: 'SHRIRAMFIN.NS', label: 'SHRIRAMFIN', name: 'Shriram Finance',                 sector: 'banking' },
  { symbol: 'LICHSGFIN.NS',  label: 'LICHSGFIN',  name: 'LIC Housing Finance',             sector: 'banking' },

  // ── FMCG ──────────────────────────────────────────────────────────────────────
  { symbol: 'ITC.NS',        label: 'ITC',        name: 'ITC',                             sector: 'fmcg' },
  { symbol: 'NESTLEIND.NS',  label: 'NESTLEIND',  name: 'Nestle India',                    sector: 'fmcg' },
  { symbol: 'BRITANNIA.NS',  label: 'BRITANNIA',  name: 'Britannia Industries',            sector: 'fmcg' },
  { symbol: 'HINDUNILVR.NS', label: 'HINDUNILVR', name: 'Hindustan Unilever',              sector: 'fmcg' },
  { symbol: 'DABUR.NS',      label: 'DABUR',      name: 'Dabur India',                     sector: 'fmcg' },
  { symbol: 'TATACONSUM.NS', label: 'TATACONSUM', name: 'Tata Consumer Products',          sector: 'fmcg' },
  { symbol: 'MARICO.NS',     label: 'MARICO',     name: 'Marico',                          sector: 'fmcg' },
  { symbol: 'GODREJCP.NS',   label: 'GODREJCP',   name: 'Godrej Consumer Products',        sector: 'fmcg' },
  { symbol: 'COLPAL.NS',     label: 'COLPAL',     name: 'Colgate-Palmolive India',         sector: 'fmcg' },
  { symbol: 'EMAMILTD.NS',   label: 'EMAMILTD',   name: 'Emami',                           sector: 'fmcg' },
  { symbol: 'UBL.NS',        label: 'UBL',        name: 'United Breweries',                sector: 'fmcg' },
  { symbol: 'VBL.NS',        label: 'VBL',        name: 'Varun Beverages',                 sector: 'fmcg' },
  { symbol: 'RADICO.NS',     label: 'RADICO',     name: 'Radico Khaitan',                  sector: 'fmcg' },
  { symbol: 'UNITDSPR.NS',   label: 'UNITDSPR',   name: 'United Spirits',                  sector: 'fmcg' },
  { symbol: 'PGHH.NS',       label: 'PGHH',       name: 'Procter & Gamble Hygiene',        sector: 'fmcg' },
  { symbol: 'JYOTHYLAB.NS',  label: 'JYOTHYLAB',  name: 'Jyothy Labs',                     sector: 'fmcg' },

  // ── Automobiles ───────────────────────────────────────────────────────────────
  { symbol: 'TMCV.NS',       label: 'TMCV',       name: 'Tata Motors (Commercial)',        sector: 'auto' },
  { symbol: 'MARUTI.NS',     label: 'MARUTI',     name: 'Maruti Suzuki',                   sector: 'auto' },
  { symbol: 'TMPV.NS',       label: 'TMPV',       name: 'Tata Motors (Passenger)',         sector: 'auto' },
  { symbol: 'BAJAJ-AUTO.NS', label: 'BAJAJ-AUTO', name: 'Bajaj Auto',                      sector: 'auto' },
  { symbol: 'M&M.NS',        label: 'M&M',        name: 'Mahindra & Mahindra',             sector: 'auto' },
  { symbol: 'EICHERMOT.NS',  label: 'EICHERMOT',  name: 'Eicher Motors',                   sector: 'auto' },
  { symbol: 'TVSMOTOR.NS',   label: 'TVSMOTOR',   name: 'TVS Motor Company',               sector: 'auto' },
  { symbol: 'HEROMOTOCO.NS', label: 'HEROMOTOCO', name: 'Hero MotoCorp',                   sector: 'auto' },
  { symbol: 'ASHOKLEY.NS',   label: 'ASHOKLEY',   name: 'Ashok Leyland',                   sector: 'auto' },
  { symbol: 'ESCORTS.NS',    label: 'ESCORTS',    name: 'Escorts Kubota',                  sector: 'auto' },
  { symbol: 'BHARATFORG.NS', label: 'BHARATFORG', name: 'Bharat Forge',                    sector: 'auto' },
  { symbol: 'BOSCHLTD.NS',   label: 'BOSCHLTD',   name: 'Bosch',                           sector: 'auto' },
  { symbol: 'CEATLTD.NS',    label: 'CEATLTD',    name: 'CEAT',                            sector: 'auto' },
  { symbol: 'BALKRISIND.NS', label: 'BALKRISIND', name: 'Balkrishna Industries',           sector: 'auto' },
  { symbol: 'EXIDEIND.NS',   label: 'EXIDEIND',   name: 'Exide Industries',                sector: 'auto' },
  { symbol: 'MOTHERSON.NS',  label: 'MOTHERSON',  name: 'Samvardhana Motherson',           sector: 'auto' },
  { symbol: 'APOLLOTYRE.NS', label: 'APOLLOTYRE', name: 'Apollo Tyres',                    sector: 'auto' },
  { symbol: 'MRF.NS',        label: 'MRF',        name: 'MRF',                             sector: 'auto' },
  { symbol: 'SONACOMS.NS',   label: 'SONACOMS',   name: 'Sona BLW Precision Forgings',     sector: 'auto' },
  { symbol: 'SCHAEFFLER.NS', label: 'SCHAEFFLER', name: 'Schaeffler India',                sector: 'auto' },
  { symbol: 'UNOMINDA.NS',   label: 'UNOMINDA',   name: 'UNO Minda',                       sector: 'auto' },

  // ── Energy & utilities ────────────────────────────────────────────────────────
  { symbol: 'RELIANCE.NS',   label: 'RELIANCE',   name: 'Reliance Industries',             sector: 'energy' },
  { symbol: 'ONGC.NS',       label: 'ONGC',       name: 'Oil & Natural Gas Corp',          sector: 'energy' },
  { symbol: 'BPCL.NS',       label: 'BPCL',       name: 'Bharat Petroleum',                sector: 'energy' },
  { symbol: 'COALINDIA.NS',  label: 'COALINDIA',  name: 'Coal India',                      sector: 'energy' },
  { symbol: 'IOC.NS',        label: 'IOC',        name: 'Indian Oil Corporation',          sector: 'energy' },
  { symbol: 'POWERGRID.NS',  label: 'POWERGRID',  name: 'Power Grid Corporation',          sector: 'energy' },
  { symbol: 'HINDPETRO.NS',  label: 'HINDPETRO',  name: 'Hindustan Petroleum',             sector: 'energy' },
  { symbol: 'TATAPOWER.NS',  label: 'TATAPOWER',  name: 'Tata Power',                      sector: 'energy' },
  { symbol: 'ADANIGREEN.NS', label: 'ADANIGREEN', name: 'Adani Green Energy',              sector: 'energy' },
  { symbol: 'GAIL.NS',       label: 'GAIL',       name: 'GAIL (India)',                    sector: 'energy' },
  { symbol: 'NTPC.NS',       label: 'NTPC',       name: 'NTPC',                            sector: 'energy' },
  { symbol: 'ADANIENSOL.NS', label: 'ADANIENSOL', name: 'Adani Energy Solutions',          sector: 'energy' },
  { symbol: 'ADANIPOWER.NS', label: 'ADANIPOWER', name: 'Adani Power',                     sector: 'energy' },
  { symbol: 'NHPC.NS',       label: 'NHPC',       name: 'NHPC',                            sector: 'energy' },
  { symbol: 'SJVN.NS',       label: 'SJVN',       name: 'SJVN',                            sector: 'energy' },
  { symbol: 'JSWENERGY.NS',  label: 'JSWENERGY',  name: 'JSW Energy',                      sector: 'energy' },
  { symbol: 'PETRONET.NS',   label: 'PETRONET',   name: 'Petronet LNG',                    sector: 'energy' },
  { symbol: 'MGL.NS',        label: 'MGL',        name: 'Mahanagar Gas',                   sector: 'energy' },
  { symbol: 'IGL.NS',        label: 'IGL',        name: 'Indraprastha Gas',                sector: 'energy' },
  { symbol: 'TORNTPOWER.NS', label: 'TORNTPOWER', name: 'Torrent Power',                   sector: 'energy' },
  { symbol: 'GUJGASLTD.NS',  label: 'GUJGASLTD',  name: 'Gujarat Gas',                     sector: 'energy' },
  { symbol: 'OIL.NS',        label: 'OIL',        name: 'Oil India',                       sector: 'energy' },

  // ── Pharma & healthcare ───────────────────────────────────────────────────────
  { symbol: 'CIPLA.NS',      label: 'CIPLA',      name: 'Cipla',                           sector: 'pharma' },
  { symbol: 'SUNPHARMA.NS',  label: 'SUNPHARMA',  name: 'Sun Pharmaceutical',              sector: 'pharma' },
  { symbol: 'DRREDDY.NS',    label: 'DRREDDY',    name: "Dr. Reddy's Laboratories",        sector: 'pharma' },
  { symbol: 'DIVISLAB.NS',   label: 'DIVISLAB',   name: "Divi's Laboratories",             sector: 'pharma' },
  { symbol: 'APOLLOHOSP.NS', label: 'APOLLOHOSP', name: 'Apollo Hospitals',                sector: 'pharma' },
  { symbol: 'LUPIN.NS',      label: 'LUPIN',      name: 'Lupin',                           sector: 'pharma' },
  { symbol: 'TORNTPHARM.NS', label: 'TORNTPHARM', name: 'Torrent Pharmaceuticals',         sector: 'pharma' },
  { symbol: 'AUROPHARMA.NS', label: 'AUROPHARMA', name: 'Aurobindo Pharma',                sector: 'pharma' },
  { symbol: 'ALKEM.NS',      label: 'ALKEM',      name: 'Alkem Laboratories',              sector: 'pharma' },
  { symbol: 'ZYDUSLIFE.NS',  label: 'ZYDUSLIFE',  name: 'Zydus Lifesciences',              sector: 'pharma' },
  { symbol: 'GLENMARK.NS',   label: 'GLENMARK',   name: 'Glenmark Pharmaceuticals',        sector: 'pharma' },
  { symbol: 'MANKIND.NS',    label: 'MANKIND',    name: 'Mankind Pharma',                  sector: 'pharma' },
  { symbol: 'ABBOTINDIA.NS', label: 'ABBOTINDIA', name: 'Abbott India',                    sector: 'pharma' },
  { symbol: 'LAURUSLABS.NS', label: 'LAURUSLABS', name: 'Laurus Labs',                     sector: 'pharma' },
  { symbol: 'IPCALAB.NS',    label: 'IPCALAB',    name: 'Ipca Laboratories',               sector: 'pharma' },
  { symbol: 'BIOCON.NS',     label: 'BIOCON',     name: 'Biocon',                          sector: 'pharma' },
  { symbol: 'AJANTPHARM.NS', label: 'AJANTPHARM', name: 'Ajanta Pharma',                   sector: 'pharma' },
  { symbol: 'NATCOPHARM.NS', label: 'NATCOPHARM', name: 'Natco Pharma',                    sector: 'pharma' },
  { symbol: 'GRANULES.NS',   label: 'GRANULES',   name: 'Granules India',                  sector: 'pharma' },
  { symbol: 'SYNGENE.NS',    label: 'SYNGENE',    name: 'Syngene International',           sector: 'pharma' },
  { symbol: 'MAXHEALTH.NS',  label: 'MAXHEALTH',  name: 'Max Healthcare Institute',        sector: 'pharma' },
  { symbol: 'FORTIS.NS',     label: 'FORTIS',     name: 'Fortis Healthcare',               sector: 'pharma' },

  // ── Industrials, materials & infrastructure ───────────────────────────────────
  { symbol: 'ULTRACEMCO.NS', label: 'ULTRACEMCO', name: 'UltraTech Cement',                sector: 'industrials' },
  { symbol: 'GRASIM.NS',     label: 'GRASIM',     name: 'Grasim Industries',               sector: 'industrials' },
  { symbol: 'LT.NS',         label: 'LT',         name: 'Larsen & Toubro',                 sector: 'industrials' },
  { symbol: 'TATASTEEL.NS',  label: 'TATASTEEL',  name: 'Tata Steel',                      sector: 'industrials' },
  { symbol: 'JSWSTEEL.NS',   label: 'JSWSTEEL',   name: 'JSW Steel',                       sector: 'industrials' },
  { symbol: 'HINDALCO.NS',   label: 'HINDALCO',   name: 'Hindalco Industries',             sector: 'industrials' },
  { symbol: 'ADANIPORTS.NS', label: 'ADANIPORTS', name: 'Adani Ports & SEZ',               sector: 'industrials' },
  { symbol: 'AMBUJACEM.NS',  label: 'AMBUJACEM',  name: 'Ambuja Cements',                  sector: 'industrials' },
  { symbol: 'DALBHARAT.NS',  label: 'DALBHARAT',  name: 'Dalmia Bharat',                   sector: 'industrials' },
  { symbol: 'SHREECEM.NS',   label: 'SHREECEM',   name: 'Shree Cement',                    sector: 'industrials' },
  { symbol: 'ACC.NS',        label: 'ACC',        name: 'ACC',                             sector: 'industrials' },
  { symbol: 'JKCEMENT.NS',   label: 'JKCEMENT',   name: 'JK Cement',                       sector: 'industrials' },
  { symbol: 'RAMCOCEM.NS',   label: 'RAMCOCEM',   name: 'The Ramco Cements',               sector: 'industrials' },
  { symbol: 'SAIL.NS',       label: 'SAIL',       name: 'Steel Authority of India',        sector: 'industrials' },
  { symbol: 'JINDALSTEL.NS', label: 'JINDALSTEL', name: 'Jindal Steel & Power',            sector: 'industrials' },
  { symbol: 'NMDC.NS',       label: 'NMDC',       name: 'NMDC',                            sector: 'industrials' },
  { symbol: 'VEDL.NS',       label: 'VEDL',       name: 'Vedanta',                         sector: 'industrials' },
  { symbol: 'HINDZINC.NS',   label: 'HINDZINC',   name: 'Hindustan Zinc',                  sector: 'industrials' },
  { symbol: 'APLAPOLLO.NS',  label: 'APLAPOLLO',  name: 'APL Apollo Tubes',                sector: 'industrials' },
  { symbol: 'SIEMENS.NS',    label: 'SIEMENS',    name: 'Siemens',                         sector: 'industrials' },
  { symbol: 'CUMMINSIND.NS', label: 'CUMMINSIND', name: 'Cummins India',                   sector: 'industrials' },
  { symbol: 'NATIONALUM.NS', label: 'NATIONALUM', name: 'National Aluminium',              sector: 'industrials' },
  { symbol: 'ABB.NS',        label: 'ABB',        name: 'ABB India',                       sector: 'industrials' },
  { symbol: 'JSL.NS',        label: 'JSL',        name: 'Jindal Stainless',                sector: 'industrials' },
  { symbol: 'POLYCAB.NS',    label: 'POLYCAB',    name: 'Polycab India',                   sector: 'industrials' },
  { symbol: 'HAL.NS',        label: 'HAL',        name: 'Hindustan Aeronautics',           sector: 'industrials' },
  { symbol: 'THERMAX.NS',    label: 'THERMAX',    name: 'Thermax',                         sector: 'industrials' },
  { symbol: 'HAVELLS.NS',    label: 'HAVELLS',    name: 'Havells India',                   sector: 'industrials' },
  { symbol: 'BEL.NS',        label: 'BEL',        name: 'Bharat Electronics',              sector: 'industrials' },
  { symbol: 'MAZDOCK.NS',    label: 'MAZDOCK',    name: 'Mazagon Dock Shipbuilders',       sector: 'industrials' },
  { symbol: 'COCHINSHIP.NS', label: 'COCHINSHIP', name: 'Cochin Shipyard',                 sector: 'industrials' },
  { symbol: 'RVNL.NS',       label: 'RVNL',       name: 'Rail Vikas Nigam',                sector: 'industrials' },
  { symbol: 'NBCC.NS',       label: 'NBCC',       name: 'NBCC (India)',                    sector: 'industrials' },

  // ── Telecom ───────────────────────────────────────────────────────────────────
  { symbol: 'BHARTIARTL.NS', label: 'BHARTIARTL', name: 'Bharti Airtel',                   sector: 'telecom' },
  { symbol: 'IDEA.NS',       label: 'IDEA',       name: 'Vodafone Idea',                   sector: 'telecom' },
  { symbol: 'HFCL.NS',       label: 'HFCL',       name: 'HFCL',                            sector: 'telecom' },
  { symbol: 'INDUSTOWER.NS', label: 'INDUSTOWER', name: 'Indus Towers',                    sector: 'telecom' },
  { symbol: 'TATACOMM.NS',   label: 'TATACOMM',   name: 'Tata Communications',             sector: 'telecom' },
  { symbol: 'RAILTEL.NS',    label: 'RAILTEL',    name: 'RailTel Corporation',             sector: 'telecom' },
  { symbol: 'STLTECH.NS',    label: 'STLTECH',    name: 'Sterlite Technologies',           sector: 'telecom' },
  { symbol: 'ITI.NS',        label: 'ITI',        name: 'ITI',                             sector: 'telecom' },
  { symbol: 'TEJASNET.NS',   label: 'TEJASNET',   name: 'Tejas Networks',                  sector: 'telecom' },

  // ── Consumer discretionary & retail ───────────────────────────────────────────
  { symbol: 'TITAN.NS',      label: 'TITAN',      name: 'Titan Company',                   sector: 'consumer' },
  { symbol: 'ASIANPAINT.NS', label: 'ASIANPAINT', name: 'Asian Paints',                    sector: 'consumer' },
  { symbol: 'TRENT.NS',      label: 'TRENT',      name: 'Trent',                           sector: 'consumer' },
  { symbol: 'BERGEPAINT.NS', label: 'BERGEPAINT', name: 'Berger Paints India',             sector: 'consumer' },
  { symbol: 'PAGEIND.NS',    label: 'PAGEIND',    name: 'Page Industries',                 sector: 'consumer' },
  { symbol: 'DEVYANI.NS',    label: 'DEVYANI',    name: 'Devyani International',           sector: 'consumer' },
  { symbol: 'DMART.NS',      label: 'DMART',      name: 'Avenue Supermarts',               sector: 'consumer' },
  { symbol: 'WESTLIFE.NS',   label: 'WESTLIFE',   name: 'Westlife Foodworld',              sector: 'consumer' },
  { symbol: 'JUBLFOOD.NS',   label: 'JUBLFOOD',   name: 'Jubilant FoodWorks',              sector: 'consumer' },
  { symbol: 'ETERNAL.NS',    label: 'ETERNAL',    name: 'Eternal (Zomato)',                sector: 'consumer' },
  { symbol: 'NYKAA.NS',      label: 'NYKAA',      name: 'FSN E-Commerce (Nykaa)',          sector: 'consumer' },
  { symbol: 'ABFRL.NS',      label: 'ABFRL',      name: 'Aditya Birla Fashion & Retail',   sector: 'consumer' },
  { symbol: 'SAPPHIRE.NS',   label: 'SAPPHIRE',   name: 'Sapphire Foods India',            sector: 'consumer' },
  { symbol: 'SWIGGY.NS',     label: 'SWIGGY',     name: 'Swiggy',                          sector: 'consumer' },
  { symbol: 'VMART.NS',      label: 'VMART',      name: 'V-Mart Retail',                   sector: 'consumer' },
  { symbol: 'SHOPERSTOP.NS', label: 'SHOPERSTOP', name: 'Shoppers Stop',                   sector: 'consumer' },
  { symbol: 'CAMPUS.NS',     label: 'CAMPUS',     name: 'Campus Activewear',               sector: 'consumer' },
  { symbol: 'KALYANKJIL.NS', label: 'KALYANKJIL', name: 'Kalyan Jewellers India',          sector: 'consumer' },
  { symbol: 'METROBRAND.NS', label: 'METROBRAND', name: 'Metro Brands',                    sector: 'consumer' },
  { symbol: 'BATAINDIA.NS',  label: 'BATAINDIA',  name: 'Bata India',                      sector: 'consumer' },
  { symbol: 'RELAXO.NS',     label: 'RELAXO',     name: 'Relaxo Footwears',                sector: 'consumer' },
  { symbol: 'RAYMOND.NS',    label: 'RAYMOND',    name: 'Raymond',                         sector: 'consumer' },
  { symbol: 'TTKPRESTIG.NS', label: 'TTKPRESTIG', name: 'TTK Prestige',                    sector: 'consumer' },
  { symbol: 'INDHOTEL.NS',   label: 'INDHOTEL',   name: 'Indian Hotels Company',           sector: 'consumer' },
];
