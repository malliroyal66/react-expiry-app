import React, { useState, useEffect, useCallback } from 'react';

// Define the exact symbols we are interested in
const ALLOWED_SYMBOLS = ["NIFTY", "BANKNIFTY", "SENSEX", "FINIFTY", "MIDCPNIFTY", "BANKEX"];

// The target source URL for the Gzipped JSON file
const SOURCE_URL = "https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz";

// Helper function to convert Unix Timestamp (ms) to YYYY-MM-DD
const timestampToYYYYMMDD = (timestamp) => {
    if (!timestamp) return null;
    try {
        const date = new Date(Number(timestamp));
        // Check for invalid date
        if (isNaN(date.getTime())) return null; 
        
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD format for internal sorting
    } catch (e) {
        // Invalid timestamp format
        return null;
    }
};

// Helper function to format date from YYYY-MM-DD to DD-MM-YYYY for display
const formatDate = (dateString) => {
    // dateString is assumed to be in YYYY-MM-DD format
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
    }
    return dateString;
};

// --- 1. JSON Parsing and Aggregation Function ---
const parseJSONAndAggregate = (instrumentData) => {
    if (!Array.isArray(instrumentData)) {
        console.error("Input is not a valid JSON array or the GZIP file failed to decompress.");
        return [];
    }
    
    const expiryMap = {};
    ALLOWED_SYMBOLS.forEach(symbol => {
        expiryMap[symbol] = new Set();
    });

    for (const row of instrumentData) {
        const inst = row.instrument_type ? row.instrument_type.trim() : '';
        const symbol = row.underlying_symbol ? row.underlying_symbol.trim() : '';
        const expiryTimestamp = row.expiry;

        // 1. Filter: Instrument Type is CE or PE
        // 2. Filter: Symbol is in ALLOWED_SYMBOLS
        if ((inst === "CE" || inst === "PE") && ALLOWED_SYMBOLS.includes(symbol)) {
            
            // 3. Convert timestamp to YYYY-MM-DD
            const expiryDateString = timestampToYYYYMMDD(expiryTimestamp);

            // 4. Filter: Expiry is valid
            if (expiryDateString) {
                expiryMap[symbol].add(expiryDateString); 
            }
        }
    }

    // Prepare final output
    const finalData = [];

    ALLOWED_SYMBOLS.forEach(symbol => {
        const sortedDates = Array.from(expiryMap[symbol]).sort(); 
        const firstTwo = sortedDates.slice(0, 2); 

        if (firstTwo.length === 0) {
            finalData.push({ Symbol: symbol, 'Expiry Date': "NO DATA" });
        } else {
            firstTwo.forEach(exp => {
                finalData.push({ Symbol: symbol, 'Expiry Date': formatDate(exp) });
            });
        }
    });

    return finalData;
};
// --- End Parsing/Aggregation Function ---


function ExpiryDataFetcher() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState(null);
  const [isButtonHovering, setIsButtonHovering] = useState(false);
  const [hoveredRowIndex, setHoveredRowIndex] = useState(null);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);


  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // --- START: Live Fetch Logic ---
    try {
        const response = await fetch(SOURCE_URL);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}. The external server may be blocking this client request.`);
        }

        // CRITICAL STEP: Attempting to parse the response as JSON.
        // This will likely FAIL because the response body is GZIP compressed.
        const instrumentData = await response.json(); 

        const finalData = parseJSONAndAggregate(instrumentData); 
        
        setData(finalData);
        setLastRefreshTime(new Date()); 
        setError(null); 
        
    } catch (e) {
        // Catch network errors, CORS errors, and the expected JSON SyntaxError 
        // (due to trying to parse a GZIP file as JSON).
        const errorMessage = `Failed to fetch or process data. Error: ${e.message}. 
        This is typically due to the file being GZIP compressed (.gz) and the browser not being 
        able to decompress it automatically, or a restrictive CORS policy from the server.
        A dedicated server-side proxy is required for stable access.`;
        
        setError(errorMessage);
        console.error("Fetch/Processing failed:", e);

        // Clear existing data or set to default if error occurs
        setData(null); 
        setLastRefreshTime(null);
    } finally {
        setLoading(false);
    }
    // --- END: Live Fetch Logic ---
  }, []); 

  // Initial data load on component mount and setting up the interval
  useEffect(() => {
    fetchData();

    // Set up auto-fetch every 60 seconds (1 minute)
    const intervalId = setInterval(() => {
        fetchData();
    }, 60000); 

    // Cleanup
    return () => clearInterval(intervalId);
  }, [fetchData]); 

  // --- Render Logic (UI) ---
  const indexList = ALLOWED_SYMBOLS.join(', ');

  const currentButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: loading 
        ? '#c7d2fe'
        : isButtonPressed 
        ? '#4f46e5'
        : isButtonHovering 
        ? '#4f46e5'
        : primaryColor,
    cursor: loading ? 'not-allowed' : 'pointer',
    boxShadow: loading 
        ? 'none' 
        : isButtonPressed 
        ? '0 0 0 0 rgba(99, 102, 241, 0.5)'
        : '0 8px 15px -3px rgba(99, 102, 241, 0.4)',
    transform: isButtonPressed ? 'translateY(1px)' : 'translateY(0)',
  };


  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headerStyle}>📅 Next Two Index Expiries</h1>
        <p style={subHeaderStyle}>
            Attempting to fetch live data from: <span style={{ fontWeight: '600', color: '#10b981' }}>{SOURCE_URL}</span>
        </p>
      
        <button 
          onClick={fetchData} 
          disabled={loading} 
          onMouseEnter={() => setIsButtonHovering(true)}
          onMouseLeave={() => {setIsButtonHovering(false); setIsButtonPressed(false);}}
          onMouseDown={() => setIsButtonPressed(true)}
          onMouseUp={() => setIsButtonPressed(false)}
          style={currentButtonStyle}
        >
          {loading ? '⏳ Attempting Live Fetch...' : '🔄 Manual Refresh (Fetch Now)'}
        </button>

        {/* Error Message (Visible when fetch fails) */}
        {error && (
          <div style={errorContainerStyle}>
            <p style={{ fontWeight: 'bold' }}>❌ Critical Data Fetch Error:</p>
            <p style={{ fontSize: '0.875rem', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                {error}
                <br /><br />
                <span style={{fontWeight: 'bold'}}>Recommended Solution:</span> Set up a simple backend server (proxy) to fetch the GZIP file, decompress it server-side, and then send the JSON data to this React application.
            </p>
          </div>
        )}

        {/* Loading Message - show always if loading, even if old data is visible */}
        {loading && (
            <div style={loadingStyle}>
                ⏳ Attempting to download and process {SOURCE_URL}...
            </div>
        )}

        {/* Data Display Table - Renders only if 'data' exists AND no critical error */}
        {data && data.length > 0 && !error && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={listHeaderStyle}>
                Indices Tracked: <span style={{ color: '#6366f1' }}>{indexList}</span>
            </h3>
            
            <div style={tableWrapperStyle}>
              <table style={tableStyle}>
                <thead style={theadStyle}>
                  <tr>
                    <th style={thStyle}>Symbol</th>
                    <th style={thStyle}>Next Expiry Date</th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: 'white' }}>
                  {data.map((item, index) => (
                    <tr 
                        key={index} 
                        onMouseEnter={() => setHoveredRowIndex(index)}
                        onMouseLeave={() => setHoveredRowIndex(null)}
                        style={{
                            ...rowBaseStyle,
                            backgroundColor: index === hoveredRowIndex 
                                ? '#eef2ff' 
                                : index % 2 === 0 
                                ? rowEvenColor 
                                : rowOddColor,
                            borderBottom: index === data.length - 1 ? 'none' : tdBaseStyle.borderBottom,
                            boxShadow: index === hoveredRowIndex ? 'inset 4px 0 0 0 #6366f1' : 'none',
                        }}
                    >
                      <td style={{
                            ...tdSymbolStyle,
                            color: item['Expiry Date'] === 'NO DATA' ? '#ef4444' : index === hoveredRowIndex ? primaryColor : tdSymbolStyle.color
                        }}>
                            {item['Symbol']}
                        </td> 
                      <td style={{
                            ...tdDateStyle,
                            fontWeight: item['Expiry Date'] === 'NO DATA' ? '600' : '500',
                            color: item['Expiry Date'] === 'NO DATA' ? '#ef4444' : tdDateStyle.color
                        }}>
                            {item['Expiry Date']}
                        </td> 
                    </tr>
                    
                  ))}
                </tbody>
              </table>
            </div>

            <p style={footerStyle}>
              Total Expiry Records: <span style={{ fontWeight: '600', color: '#374151' }}>{data.length}</span> | 
              Last Refreshed: {lastRefreshTime.toLocaleTimeString()}
            </p>
          </div>
        )}
        
        {!loading && !data && !error && (
          <p style={noDataStyle}>
            Click 'Manual Refresh (Fetch Now)' to attempt fetching live data from Upstox instruments JSON.
          </p>
        )}

      </div>
    </div>
  );
}

export default ExpiryDataFetcher;

// --- Beautiful, Modern Inline CSS Styles ---

const primaryColor = '#6366f1'; 
const secondaryColor = '#818cf8'; 
const headerBgColor = primaryColor;
const rowEvenColor = 'white';
const rowOddColor = '#f9fafb';

const containerStyle = {
    padding: '1rem', 
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    fontFamily: 'Inter, sans-serif',
};

const cardStyle = {
    maxWidth: '40rem', 
    margin: '1.5rem auto',
    backgroundColor: 'white',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
    borderRadius: '1rem', 
    padding: '2rem', 
};

const headerStyle = {
    fontSize: '2rem', 
    fontWeight: '700', 
    color: primaryColor, 
    marginBottom: '0.5rem',
    textShadow: '0 1px 1px rgba(0,0,0,0.05)',
};

const subHeaderStyle = {
    color: '#64748b',
    marginBottom: '1.5rem',
    fontSize: '0.875rem', 
};

const buttonBaseStyle = {
    width: '100%',
    padding: '0.75rem 1.5rem', 
    fontSize: '1rem', 
    fontWeight: '600', 
    borderRadius: '0.5rem', 
    color: 'white',
    border: 'none',
    transition: 'background-color 0.2s, box-shadow 0.2s, transform 0.1s',
    outline: 'none',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
};

const errorContainerStyle = {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#fee2e2', 
    borderLeft: '4px solid #f87171', 
    color: '#b91c1c', 
    borderRadius: '0.375rem', 
    fontWeight: '500',
    whiteSpace: 'normal',
};

const loadingStyle = {
    marginTop: '1rem',
    padding: '1rem',
    color: secondaryColor, 
    fontWeight: '500', 
};

const listHeaderStyle = {
    fontSize: '1rem', 
    fontWeight: '600', 
    color: '#374151', 
    marginBottom: '0.75rem',
};

const tableWrapperStyle = {
    overflow: 'hidden', 
    borderRadius: '0.75rem', 
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)',
    border: '1px solid #e5e7eb',
};

const tableStyle = {
    minWidth: '100%',
    borderCollapse: 'collapse',
};

const theadStyle = {
    backgroundColor: headerBgColor,
};

const thStyle = {
    padding: '1rem 1.5rem', 
    textAlign: 'left',
    fontSize: '0.75rem', 
    fontWeight: '700', 
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: '0.05em', 
    border: 'none',
    
};

const tdBaseStyle = {
    padding: '1.2rem 1.5rem', 
    fontSize: '0.9rem', 
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #f3f4f6',
};

const tdSymbolStyle = {
    ...tdBaseStyle,
    fontWeight: '700', 
    color: '#1f2937',
    letterSpacing: '0.02em',
};

const tdDateStyle = {
    ...tdBaseStyle,
    color: '#374151', 
};

const rowBaseStyle = {
    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
};

const footerStyle = {
    marginTop: '1rem',
    fontSize: '0.875rem', 
    color: '#64748b', 
    paddingTop: '0.5rem',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center',
};

const noDataStyle = {
    marginTop: '2rem',
    padding: '1rem',
    backgroundColor: '#fffbeb', 
    borderLeft: '4px solid #fcd34d', 
    color: '#92400e', 
    borderRadius: '0.375rem', 
    fontWeight: '500',
};
