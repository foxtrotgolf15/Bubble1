import json
import os
from typing import List, Optional
from models import TableEntry, DecompressionResult, DecompressionStop, ActualInputs, RoundedValues
import logging

logger = logging.getLogger(__name__)

class DecompressionService:
    def __init__(self):
        self.table_data = self._load_decompression_table()
    
    def _load_decompression_table(self) -> List[TableEntry]:
        """Load the US Navy Rev 7 decompression table from JSON"""
        table_path = os.path.join(os.path.dirname(__file__), '..', 'decompression_table.json')
        
        try:
            with open(table_path, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)
            
            # Convert to TableEntry objects
            table_entries = []
            for entry in raw_data:
                try:
                    table_entry = TableEntry(**entry)
                    table_entries.append(table_entry)
                except Exception as e:
                    logger.warning(f"Skipped invalid table entry: {e}")
                    continue
            
            logger.info(f"Loaded {len(table_entries)} decompression table entries")
            return table_entries
            
        except Exception as e:
            logger.error(f"Failed to load decompression table: {e}")
            raise Exception(f"Could not load decompression table: {e}")
    
    def get_available_depths(self) -> List[float]:
        """Get all unique depths from the table"""
        depths = list(set([entry.profundidad_m for entry in self.table_data]))
        return sorted(depths)
    
    def get_available_times_for_depth(self, depth: float) -> List[int]:
        """Get all available times for a specific depth"""
        times = [entry.tiempo_fondo_min for entry in self.table_data 
                if entry.profundidad_m == depth]
        return sorted(list(set(times)))
    
    def get_max_time_for_depth(self, depth: float) -> Optional[int]:
        """Get the maximum available time for a specific depth"""
        times = self.get_available_times_for_depth(depth)
        return max(times) if times else None
    
    def find_equal_or_next_greater(self, target: float, available_values: List[float]) -> float:
        """Find the equal or next greater value from available values"""
        available_values = sorted(available_values)
        
        for value in available_values:
            if value >= target:
                return value
        
        # If no greater value found, return the maximum available
        return max(available_values) if available_values else target
    
    def find_table_entry(self, depth: float, time: int) -> Optional[TableEntry]:
        """Find the exact table entry for given depth and time"""
        for entry in self.table_data:
            if entry.profundidad_m == depth and entry.tiempo_fondo_min == time:
                return entry
        return None
    
    def extract_decompression_stops(self, entry: TableEntry) -> List[DecompressionStop]:
        """Extract decompression stops from a table entry"""
        stops = []
        
        # Define stop depths in descending order (deepest first)
        stop_depths = [
            (39.6, entry.parada_39_6m),
            (36.6, entry.parada_36_6m),
            (33.5, entry.parada_33_5m),
            (30.5, entry.parada_30_5m),
            (27.4, entry.parada_27_4m),
            (24.4, entry.parada_24_4m),
            (21.3, entry.parada_21_3m),
            (18.3, entry.parada_18_3m),
            (15.2, entry.parada_15_2m),
            (12.2, entry.parada_12_2m),
            (9.1, entry.parada_9_1m),
            (6.1, entry.parada_6_1m),
        ]
        
        for depth, duration in stop_depths:
            if duration is not None and duration > 0:
                stops.append(DecompressionStop(depth=depth, duration=duration))
        
        return stops
    
    def calculate_time_to_first_stop(self, max_depth: float, first_stop_depth: float) -> int:
        """Calculate time to reach first decompression stop at 9 m/min ascent rate"""
        if not first_stop_depth:
            return 0
        
        distance = max_depth - first_stop_depth
        # 9 meters per minute ascent rate
        time_minutes = distance / 9.0
        return max(1, round(time_minutes))  # At least 1 minute
    
    def calculate_decompression(
        self, 
        max_depth: float, 
        bottom_time: int,
        altitude: float,
        breathing_gas: str,
        oxygen_deco: str
    ) -> DecompressionResult:
        """
        Calculate decompression requirements based on US Navy Rev 7 table
        """
        try:
            # Step 1: Get available depths and times
            available_depths = self.get_available_depths()
            
            # Step 2: Round depth to equal or next greater available depth
            rounded_depth = self.find_equal_or_next_greater(max_depth, available_depths)
            
            # Step 3: Get available times for the rounded depth
            available_times = self.get_available_times_for_depth(rounded_depth)
            max_time = self.get_max_time_for_depth(rounded_depth)
            
            # Step 4: Check if bottom time exceeds maximum available for this depth
            if max_time and bottom_time > max_time:
                raise Exception("No se puede tabular esa inmersión por demasiada exposición.")
            
            # Step 5: Round time to equal or next greater available time
            rounded_time = int(self.find_equal_or_next_greater(bottom_time, available_times))
            
            # Step 6: Find the exact table entry
            table_entry = self.find_table_entry(rounded_depth, rounded_time)
            
            if not table_entry:
                raise Exception(f"No table entry found for depth {rounded_depth}m and time {rounded_time} minutes")
            
            # Step 7: Extract decompression stops
            decompression_stops = self.extract_decompression_stops(table_entry)
            
            # Step 8: Determine if this is a no-decompression dive
            no_deco_dive = len(decompression_stops) == 0
            
            # Step 9: Calculate time to first stop
            first_stop_depth = decompression_stops[0].depth if decompression_stops else None
            time_to_first_stop = self.calculate_time_to_first_stop(max_depth, first_stop_depth) if first_stop_depth else 0
            
            # Step 10: Build the result
            result = DecompressionResult(
                noDecompressionDive=no_deco_dive,
                decompressionStops=decompression_stops,
                actualInputs=ActualInputs(depth=max_depth, bottomTime=bottom_time),
                roundedValues=RoundedValues(depth=rounded_depth, time=rounded_time),
                tableUsed="US Navy Rev 7 – Tabla de Aire I",
                tableCell=f"Profundidad: {rounded_depth}m / Tiempo: {rounded_time}min",
                altitude=altitude,
                breathingGas=breathing_gas,
                oxygenDeco=oxygen_deco,
                totalAscentTime=table_entry.tiempo_total_ascenso,
                repetitiveGroup=table_entry.grupo_repeticion,
                timeToFirstStop=time_to_first_stop  # Add this new field
            )
            
            logger.info(f"Calculated decompression for {max_depth}m/{bottom_time}min -> {rounded_depth}m/{rounded_time}min, No-deco: {no_deco_dive}, Stops: {len(decompression_stops)}")
            
            return result
            
        except Exception as e:
            logger.error(f"Decompression calculation failed: {e}")
            raise Exception(f"{e}")

# Global service instance
decompression_service = DecompressionService()