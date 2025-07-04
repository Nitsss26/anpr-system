#!/usr/bin/env python3
"""
Setup script to download and prepare YOLO models for ANPR
"""

import os
import urllib.request
from ultralytics import YOLO

def setup_models():
    """Download and setup YOLO models"""
    models_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(models_dir, exist_ok=True)
    
    print("Setting up YOLO models for ANPR...")
    
    # Download YOLOv8 nano model (general purpose)
    print("Downloading YOLOv8 nano model...")
    model = YOLO('yolov8n.pt')
    
    # For now, we'll use the general model
    # In production, you would train a custom model on Indian number plates
    print("Models setup complete!")
    print("Note: For better accuracy, train a custom YOLOv8 model on Indian number plates")

if __name__ == "__main__":
    setup_models()
