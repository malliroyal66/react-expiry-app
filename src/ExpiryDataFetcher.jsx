// This file contains the serverless function logic to run on Vercel.
// It securely fetches data from external sources (like Google Sheets) and returns
// clean JSON to the React frontend, bypassing CORS and security issues.

import { GoogleSpreadsheet } from 'google-spreadsheet';

// --- 1. GOOGLE SHEETS CONFIGURATION ---
// These are loaded from Vercel Environment Variables
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.G_SHEET_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.G_SHEET_PRIVATE_KEY?.replace(/\\n/g, '\n'); // Handle newline characters

// --- Date Parsing Utility (New) ---
// Function to convert "DD/MM/YYYY" or "YYYY-MM-DD" string format to Unix milliseconds.
function parseDateToTimestamp(dateString) {
    if (!dateString) return 0;
    
    // Check for common formats (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD)
    let dateParts;
    if (dateString.includes('-')) {
        dateParts = dateString.split('-');
    } else if (dateString.includes('/')) {
        dateParts = dateString.split('/');
    } else {
        // Assume YYYYMMDD if no delimiters found
        if (dateString.length === 8) {
             dateParts = [dateString.substring(0,4), dateString.substring(4,6), dateString.substring(6,8)];
        } else {
             return 0;
        }
    }
    
    if (dateParts.length !== 3) return 0;

    let year, month, day;
    // Attempt to guess D/M/Y vs Y/M/D order
    if (dateParts[0].length === 4) { // YYYY-MM-DD
        year = dateParts[0];
        month = dateParts[1];
        day = dateParts[2];
    } else { // DD-MM-YYYY or MM-DD-YYYY (Assuming DD-MM-YYYY which is common for Indian indices)
        day = dateParts[0];
        month = dateParts[1];
        year = dateParts[2];
    }

    // Date constructor expects YYYY, MM-1, DD
    const date = new Date(year, month - 1, day);
    
    // Validate date and return timestamp in milliseconds
    return isNaN(date.getTime()) ? 0 : date.getTime();
}


// --- 2. DATA FETCHING FUNCTION ---
async function fetchSheetData() {
    // CRITICAL: Check for credentials before attempting connection
    if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
        console.error("ERROR: Google Sheet credentials are missing from Vercel Environment Variables. Cannot connect to live data.");
        // Return empty array when no credentials found (no mock data fallback)
        return []; 
    }

    try {
        const doc = new GoogleSpreadsheet(SHEET_ID);

        // Authenticate using the service account credentials
        await doc.useServiceAccountAuth({
            client_email: CLIENT_EMAIL,
            private_key: PRIVATE_KEY,
        });

        // Load the document info
        await doc.loadInfo(); 
        
        // Assume data is on the first sheet (index 0)
        const sheet = doc.sheetsByIndex[0]; 
        
        // Fetch all rows as objects. Headers must be in the first row.
        const rows = await sheet.getRows();

        // --- MAPPING LOGIC FOR USER'S COLUMN NAMES ---
        const instrumentData = rows
            .filter(row => row.Symbol && row["Expiry Date"]) // Only process rows with both columns filled
            .map(row => {
                const rawDate = row["Expiry Date"];
                const timestamp = parseDateToTimestamp(rawDate);
                
                // Returning a simplified structure: we only care about Symbol and Expiry date
                return {
                    "underlying_symbol": row.Symbol.trim(), 
                    "expiry": timestamp, // Unix timestamp in milliseconds
                    // We need 'instrument_type' for the frontend filter logic (CE/PE). 
                    // Since the sheet doesn't provide it, we duplicate the entry 
                    // with a placeholder type so the frontend logic works.
                    "instrument_type": "CE" 
                };
            });
        
        // Augment the data by duplicating each entry as 'PE' to ensure the frontend's 
        // expiry aggregation logic correctly finds the unique dates.
        const augmentedData = instrumentData.flatMap(item => [
            {...item, instrument_type: "CE"},
            {...item, instrument_type: "PE"}
        ]);
        
        console.log(`Successfully retrieved and augmented ${instrumentData.length} unique expiry records from Google Sheet.`);
        return augmentedData;

    } catch (error) {
        console.error("Error fetching data from Google Sheet:", error.message);
        // Return empty array on runtime connection/API error
        return []; 
    }
}


// --- 3. VERCEL SERVERLESS HANDLER ---
export default async function handler(req, res) {
    // Only allow GET requests from the frontend
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Attempt to fetch data from the sheet
    const finalData = await fetchSheetData();

    // Vercel serverless function returns the processed raw data array
    res.status(200).json(finalData);
}
