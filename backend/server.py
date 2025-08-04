from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime

# Import our decompression models and service
from models import DecompressionRequest, DecompressionResult
from decompression_service import decompression_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models for existing endpoints
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Existing routes
@api_router.get("/")
async def root():
    return {"message": "Calculadora de Descompresión de Buceo API"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# New decompression endpoints
@api_router.post("/decompression/calculate", response_model=DecompressionResult)
async def calculate_decompression(request: DecompressionRequest):
    """
    Calculate decompression stops based on dive parameters using US Navy Rev 7 table
    """
    try:
        result = decompression_service.calculate_decompression(
            max_depth=request.maxDepth,
            bottom_time=request.bottomTime,
            altitude=request.altitude,
            breathing_gas=request.breathingGas,
            oxygen_deco=request.oxygenDeco
        )
        return result
    except Exception as e:
        logging.error(f"Decompression calculation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/decompression/table-info")
async def get_table_info():
    """
    Get information about available depths and times in the decompression table
    """
    try:
        available_depths = decompression_service.get_available_depths()
        
        # Get sample times for the first few depths
        sample_info = {}
        for depth in available_depths[:5]:  # First 5 depths as examples
            times = decompression_service.get_available_times_for_depth(depth)
            sample_info[f"{depth}m"] = {
                "times": times[:5],  # First 5 times
                "total_entries": len(times)
            }
        
        return {
            "table_name": "US Navy Rev 7 – Tabla de Aire I",
            "total_depths": len(available_depths),
            "depth_range": {
                "min": min(available_depths),
                "max": max(available_depths)
            },
            "available_depths": available_depths,
            "sample_depth_times": sample_info
        }
    except Exception as e:
        logging.error(f"Table info error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()