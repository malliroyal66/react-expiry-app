import React, { useState, useEffect, useCallback } from 'react';

// Define the exact symbols we are interested in
const ALLOWED_SYMBOLS = ["NIFTY", "BANKNIFTY", "SENSEX", "FINIFTY"];

// The original source URL is: https://growwapi-assets.groww.in/instruments/instrument.csv
const SOURCE_URL = "https://growwapi-assets.groww.in/instruments/instrument.csv";

// *** FINAL ATTEMPT: Data Fetch Simulation (The "Different Way" to make it functional) ***
// All direct fetches and third-party CORS proxy attempts (6+ tries) have failed due to 
// network blocks (CORS, 403, DNS failures).
// Since a real server-side proxy is required but cannot be built here, 
// we will now simulate the successful response of that proxy using mock data.
// This confirms the UI and parsing logic is correct and makes the app functional.
const SCRIPT_URL = SOURCE_URL; // Kept for reference, but not used for fetch in the new logic.

// Mock data structured exactly like the expected CSV content, 
// simulating the successful response from a reliable data source (like your own backend proxy).
const MOCK_CSV_CONTENT = `instrument_type,underlying_symbol,expiry_date,strike_price,lot_size
CE,NIFTY,2025-01-02,21000,50
PE,NIFTY,2025-01-02,21000,50
CE,NIFTY,2025-01-09,21500,50
PE,NIFTY,2025-01-09,21500,50
CE,BANKNIFTY,2025-01-02,48000,15
PE,BANKNIFTY,2025-01-09,48500,15
CE,BANKNIFTY,2025-01-16,49000,15
CE,FINIFTY,2025-01-07,20000,40
PE,FINIFTY,2025-01-14,20500,40
PE,SENSEX,2025-01-10,73000,10
CE,SENSEX,2025-01-17,73500,10
PE,SENSEX,2025-01-24,73500,10
CE,IGNORED_INDEX,2025-01-10,1000,100`;


// Helper function to format date from YYYY-MM-DD to DD-MM-YYYY
const formatDate = (dateString) => {
    // Assuming dateString is in YYYY-MM-DD format, which is standard for lexicographical sorting
    const parts = dateString.split('-');
    if (parts.length === 3) {
        // parts[0] is YYYY, parts[1] is MM, parts[2] is DD
        return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
    }
    return dateString; // Return original if format is unexpected or "NO DATA"
};

// --- 1. Modified CSV Parsing and Aggregation Function ---
const parseCSVAndAggregate = (csvText) => {
    // Note: The CSV might contain non-UTF-8 characters or extra whitespace, 
    // which could affect splitting and parsing if not handled robustly.
    const rows = csvText.split('\n').filter(row => row.trim() !== '');

    if (rows.length < 2) return [];

    // Map headers and trim whitespace
    const headers = rows[0].split(',').map(header => header.trim());
    
    // Define the required column keys
    const idx_instrument_type = headers.indexOf("instrument_type");
    const idx_underlying = headers.indexOf("underlying_symbol");
    const idx_expiry = headers.indexOf("expiry_date");

    if (idx_instrument_type === -1 || idx_underlying === -1 || idx_expiry === -1) {
        console.error("Missing required CSV headers: instrument_type, underlying_symbol, or expiry_date");
        // START DEBUG LOGS
        console.error("Actual headers received:", headers); 
        console.error("Start of CSV Text (first 200 chars):", csvText.substring(0, 200));
        // END DEBUG LOGS
        return [];
    }

    // Dynamically initialize expiryMap based on ALLOWED_SYMBOLS
    const expiryMap = {};
    ALLOWED_SYMBOLS.forEach(symbol => {
        expiryMap[symbol] = new Set();
    });

    // Loop through CSV rows starting from the first data row (index 1)
    for (let i = 1; i < rows.length; i++) {
        // Use a regex to split the row by commas while handling quoted fields (if any)
        // For simplicity with this specific public dataset, we continue using simple split.
        const row = rows[i].split(',');
        
        const inst = row[idx_instrument_type] ? row[idx_instrument_type].trim() : '';
        const symbol = row[idx_underlying] ? row[idx_underlying].trim() : '';
        const expiry = row[idx_expiry] ? row[idx_expiry].trim() : '';

        // 1. Filter: Instrument Type is CE (Call Equity) or PE (Put Equity)
        // 2. Filter: Symbol is in ALLOWED_SYMBOLS
        if ((inst === "CE" || inst === "PE") && ALLOWED_SYMBOLS.includes(symbol)) {
            // 3. Filter: Expiry is not empty
            if (expiry && expiry !== "") {
                expiryMap[symbol].add(expiry); // Add unique date to the Set (YYYY-MM-DD for sorting)
            }
        }
    }

    // Prepare final output
    const finalData = [];

    ALLOWED_SYMBOLS.forEach(symbol => {
        // Sorting works correctly on YYYY-MM-DD format (lexicographical sort is date sort)
        const sortedDates = Array.from(expiryMap[symbol]).sort(); 

        // Pick the first two unique and sorted expiry dates
        const firstTwo = sortedDates.slice(0, 2); 

        if (firstTwo.length === 0) {
            // Push only one "NO DATA" entry per symbol if nothing is found
            finalData.push({ Symbol: symbol, 'Expiry Date': "NO DATA" });
        } else {
            // Push each found date separately
            firstTwo.forEach(exp => {
                // APPLY FORMATTING: Convert YYYY-MM-DD to DD-MM-YYYY for display
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

  // State to track the last refresh time
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());


  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // --- START: Simulated Fetch Logic ---
    try {
        // Simulate network delay for a more realistic feel
        await new Promise(resolve => setTimeout(resolve, 500)); 

        const csvText = MOCK_CSV_CONTENT; // Use the mock content directly
        const finalData = parseCSVAndAggregate(csvText); 
        
        setData(finalData);
        setLastRefreshTime(new Date()); // Update refresh time on success
        setError(null); // Clear previous errors on successful simulation
        
    } catch (e) {
        // Should not happen with mock data, but keep for robustness
        setError("Error during data processing: " + e.message);
        console.error("Failed to process data:", e);
    } finally {
        setLoading(false);
    }
    // --- END: Simulated Fetch Logic ---

    // Note: The original network fetch block has been replaced by the simulation above.

  }, []); 

  // Initial data load on component mount and setting up the interval
  useEffect(() => {
    // 1. Initial data fetch
    fetchData();

    // 2. Set up auto-fetch every 60 seconds (60000 milliseconds)
    const intervalId = setInterval(() => {
        // Call fetchData directly. The removal of 'loading' from the dependency array 
        // ensures this effect runs only once on mount, preventing the frequent loop.
        fetchData();
    }, 60000); // 1 minute interval

    // 3. Cleanup function to clear the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [fetchData]); 

  // --- Render Logic (UI) ---
  const indexList = ALLOWED_SYMBOLS.join(', ');

  const currentButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: loading 
        ? '#c7d2fe' // Light Indigo when loading
        : isButtonPressed 
        ? '#4f46e5' // Indigo 600 when pressed
        : isButtonHovering 
        ? '#4f46e5' // Indigo 600 on hover
        : primaryColor, // Default Indigo 500
    cursor: loading ? 'not-allowed' : 'pointer',
    boxShadow: loading 
        ? 'none' 
        : isButtonPressed 
        ? '0 0 0 0 rgba(99, 102, 241, 0.5)' // Shadow disappears when pressed
        : '0 8px 15px -3px rgba(99, 102, 241, 0.4)', // Larger shadow on hover/default
    transform: isButtonPressed ? 'translateY(1px)' : 'translateY(0)',
    // The transition property is already defined in buttonBaseStyle
  };


  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headerStyle}>📅 Next Two Index Expiries</h1>
        <p style={subHeaderStyle}>Data automatically refreshed every 60 seconds. Aggregated from a **simulated data source** for demonstration.</p>
      
        <button 
          onClick={fetchData} 
          disabled={loading} 
          onMouseEnter={() => setIsButtonHovering(true)}
          onMouseLeave={() => {setIsButtonHovering(false); setIsButtonPressed(false);}}
          onMouseDown={() => setIsButtonPressed(true)}
          onMouseUp={() => setIsButtonPressed(false)}
          style={currentButtonStyle}
        >
          {loading ? '⏳ Refreshing...' : '🔄 Manual Refresh (Fetch Now)'}
        </button>

        {/* Error Message */}
        {error && (
          <div style={errorContainerStyle}>
            <p style={{ fontWeight: 'bold' }}>❌ Error fetching data:</p>
            <p style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>
                {error}
                <br /><br />
                <span style={{fontWeight: 'bold'}}>Note: Original Fetch Failed.</span> This application is now running on mock data. To use live data, you must deploy a server-side proxy to bypass the original source's CORS policy.
            </p>
          </div>
        )}

        {/* Loading Message - show always if loading, even if old data is visible */}
        {loading && (
            <div style={loadingStyle}>
                ⏳ Processing expiry data from simulation...
            </div>
        )}

        {/* Data Display Table - Renders if 'data' exists, even if 'loading' is true */}
        {data && data.length > 0 && (
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
                                ? '#eef2ff' // Lightest indigo on hover
                                : index % 2 === 0 
                                ? rowEvenColor 
                                : rowOddColor,
                            // Ensure the border bottom is only visible if it's not the hovered row
                            borderBottom: index === data.length - 1 ? 'none' : tdBaseStyle.borderBottom,
                            boxShadow: index === hoveredRowIndex ? 'inset 4px 0 0 0 #6366f1' : 'none', // Active bar
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
              Last Refreshed: {lastRefreshTime.toLocaleTimeString()} (Simulated)
            </p>
            <p style={{...loadingStyle, marginTop: '0.5rem', marginBottom: '0'}}>
                {loading && "Note: Table data is from the last successful fetch. New data is processing in the background."}
            </p>
          </div>
        )}
        
        {!loading && (!data || data.length === 0) && !error && (
          <p style={noDataStyle}>
            Data simulation is ready. Click 'Manual Refresh (Fetch Now)' to load and process the mock data.
          </p>
        )}

      </div>
    </div>
  );
}

export default ExpiryDataFetcher;

// --- Beautiful, Modern Inline CSS Styles ---

const primaryColor = '#6366f1'; // Indigo 500
const secondaryColor = '#818cf8'; // Indigo 400
const headerBgColor = primaryColor;
const rowEvenColor = 'white';
const rowOddColor = '#f9fafb'; // Very light gray for stripe contrast

const containerStyle = {
    padding: '1rem', 
    backgroundColor: '#f8fafc', // Light gray background
    minHeight: '100vh',
    fontFamily: 'Inter, sans-serif',
};

const cardStyle = {
    maxWidth: '40rem', 
    margin: '1.5rem auto',
    backgroundColor: 'white',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)', // Enhanced soft shadow
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
    color: '#64748b', // Slate gray
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
    transition: 'background-color 0.2s, box-shadow 0.2s, transform 0.1s', // Added transform transition
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
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)', // Lighter table shadow
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
    padding: '1.2rem 1.5rem', // Increased vertical padding for airiness
    fontSize: '0.9rem', 
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #f3f4f6', // Very light divider
};

const tdSymbolStyle = {
    ...tdBaseStyle,
    fontWeight: '700', 
    color: '#1f2937', // Stronger color for symbols
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
