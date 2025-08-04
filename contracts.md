# Dive Decompression Calculator - Backend Integration Contracts

## API Contracts

### 1. POST /api/decompression/calculate
**Purpose**: Calculate decompression stops based on dive parameters

**Request Body**:
```json
{
  "maxDepth": number,        // Maximum depth in meters
  "bottomTime": number,      // Bottom time in minutes  
  "altitude": number,        // Altitude above sea level in meters
  "breathingGas": "Air",     // Fixed value for current scope
  "oxygenDeco": "Yes" | "No" // Oxygen decompression selection
}
```

**Response**:
```json
{
  "noDecompressionDive": boolean,
  "decompressionStops": [
    {
      "depth": number,    // Stop depth in meters
      "duration": number  // Stop duration in minutes
    }
  ],
  "actualInputs": {
    "depth": number,
    "bottomTime": number
  },
  "roundedValues": {
    "depth": number,    // Rounded to nearest table depth
    "time": number      // Rounded to nearest table time
  },
  "tableUsed": "US Navy Rev 7 – Air Table I",
  "tableCell": "depth/time combination used",
  "altitude": number,
  "breathingGas": "Air", 
  "oxygenDeco": "Yes" | "No",
  "totalAscentTime": string,  // Format: "HH:MM:SS"
  "repetitiveGroup": string
}
```

## Mock Data Replacement

Currently mocked in `/frontend/src/mock.js`:
- `mockDecompressionTable` - Sample table entries
- `mockCalculateDecompression()` - Mock calculation logic

**To Replace**: 
- Remove mock import from `DiveCalculator.jsx`
- Replace `mockCalculateDecompression()` call with API call to `/api/decompression/calculate`
- Use actual decompression table data from `/app/decompression_table.json`

## Backend Implementation Tasks

### 1. Data Models
- **DecompressionRequest**: Input validation model
- **DecompressionResult**: Response model
- **DecompressionTableEntry**: Database/JSON table structure

### 2. Core Logic Implementation
- **Table Lookup**: Load decompression table from JSON
- **Depth Rounding**: Round user depth to next greater table depth
- **Time Rounding**: Round user time to next greater table time  
- **Stop Extraction**: Parse decompression stops from table entry
- **Time Calculation**: Calculate total ascent time
- **Safety Logic**: Determine if no decompression dive

### 3. API Endpoints
- `POST /api/decompression/calculate` - Main calculation endpoint
- `GET /api/decompression/table` - Optional: return available table depths/times
- Error handling for invalid inputs

### 4. Calculation Algorithm (Exact Implementation)
```python
def calculate_decompression(max_depth, bottom_time, altitude, breathing_gas, oxygen_deco):
    # 1. Load JSON table
    table = load_decompression_table()
    
    # 2. Round depth to equal or next greater available depth
    available_depths = get_unique_depths(table)
    rounded_depth = find_equal_or_next_greater(max_depth, available_depths)
    
    # 3. Round time to equal or next greater available time for that depth
    available_times = get_times_for_depth(table, rounded_depth)
    rounded_time = find_equal_or_next_greater(bottom_time, available_times)
    
    # 4. Lookup table entry
    entry = find_table_entry(table, rounded_depth, rounded_time)
    
    # 5. Extract decompression stops (6.1m, 9.1m, 12.2m, etc.)
    stops = extract_stops(entry)
    
    # 6. Determine if no decompression dive
    no_deco = len(stops) == 0 or all(stop['duration'] == 0 for stop in stops)
    
    # 7. Return structured result
    return format_result(...)
```

## Frontend & Backend Integration

### Changes Required in `DiveCalculator.jsx`:

1. **Remove mock import**:
   ```javascript
   // Remove: import { mockCalculateDecompression } from '../mock';
   ```

2. **Add API call**:
   ```javascript
   const handleCalculate = async () => {
     if (validateScreen2()) {
       try {
         const response = await axios.post(`${API}/decompression/calculate`, {
           maxDepth: parseFloat(formData.maxDepth),
           bottomTime: parseFloat(formData.bottomTime), 
           altitude: parseFloat(formData.altitude),
           breathingGas: formData.breathingGas,
           oxygenDeco: formData.oxygenDeco
         });
         setResults(response.data);
         setCurrentScreen(3);
       } catch (error) {
         // Handle API errors
       }
     }
   };
   ```

3. **Error Handling**: Add loading states and error messages for API failures

## Testing Requirements

### Backend Testing:
- Unit tests for calculation logic
- Edge cases: minimum depths, maximum times
- Input validation testing
- JSON table loading verification

### Integration Testing:
- Full workflow from Screen 1 → Screen 2 → Screen 3
- Various dive profiles (no-deco, single stop, multiple stops)
- Error scenarios (invalid inputs, API failures)

## Data Source
- Primary: `/app/decompression_table.json` (US Navy Rev 7 data)
- Format: Array of objects with depth, time, and stop information
- Fields: `Profundidad (m)`, `Tiempo de Fondo (min)`, various stop depths, total ascent time, repetitive group