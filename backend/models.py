from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class DecompressionRequest(BaseModel):
    maxDepth: float = Field(..., gt=0, description="Maximum depth in meters")
    bottomTime: int = Field(..., gt=0, description="Bottom time in minutes")
    altitude: float = Field(..., ge=0, description="Altitude above sea level in meters")
    breathingGas: str = Field(..., description="Breathing gas type")
    oxygenDeco: str = Field(..., description="Oxygen decompression option")

class DecompressionStop(BaseModel):
    depth: float = Field(..., description="Stop depth in meters")
    duration: float = Field(..., description="Stop duration in minutes")

class ActualInputs(BaseModel):
    depth: float
    bottomTime: int

class RoundedValues(BaseModel):
    depth: float
    time: int

class DecompressionResult(BaseModel):
    noDecompressionDive: bool
    decompressionStops: List[DecompressionStop]
    actualInputs: ActualInputs
    roundedValues: RoundedValues
    tableUsed: str
    tableCell: str
    altitude: float
    breathingGas: str
    oxygenDeco: str
    totalAscentTime: str
    repetitiveGroup: str
    timeToFirstStop: Optional[int] = 0  # New field for time to first stop

class TableEntry(BaseModel):
    profundidad_m: float = Field(..., alias="Profundidad (m)")
    tiempo_fondo_min: int = Field(..., alias="Tiempo de Fondo (min)")
    tiempo_primera_parada: Optional[str] = Field(None, alias="Tiempo hasta la primera parada")
    parada_39_6m: Optional[float] = Field(None, alias="Parada 39.6m")
    parada_36_6m: Optional[float] = Field(None, alias="Parada 36.6m")
    parada_33_5m: Optional[float] = Field(None, alias="Parada 33.5m")
    parada_30_5m: Optional[float] = Field(None, alias="Parada 30.5m")
    parada_27_4m: Optional[float] = Field(None, alias="Parada 27.4m")
    parada_24_4m: Optional[float] = Field(None, alias="Parada 24.4m")
    parada_21_3m: Optional[float] = Field(None, alias="Parada 21.3m")
    parada_18_3m: Optional[float] = Field(None, alias="Parada 18.3m")
    parada_15_2m: Optional[float] = Field(None, alias="Parada 15.2m")
    parada_12_2m: Optional[float] = Field(None, alias="Parada 12.2m")
    parada_9_1m: Optional[float] = Field(None, alias="Parada 9.1m")
    parada_6_1m: Optional[float] = Field(None, alias="Parada 6.1m")
    tiempo_total_ascenso: str = Field(..., alias="Tiempo Total Ascenso (min)")
    grupo_repeticion: str = Field(..., alias="Grupo Repetición")

    class Config:
        populate_by_name = True