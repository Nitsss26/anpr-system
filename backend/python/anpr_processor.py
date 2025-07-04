#!/usr/bin/env python3
"""
ANPR Processor for Indian Number Plates
Uses YOLOv8 for detection and EasyOCR for text recognition
"""

import sys
import json
import cv2
import numpy as np
import easyocr
import re
from ultralytics import YOLO
import torch
from datetime import datetime
import os

class IndianANPRProcessor:
    def __init__(self, confidence_threshold=0.5, processing_mode='standard'):
        self.confidence_threshold = confidence_threshold
        self.processing_mode = processing_mode
        
        # Initialize EasyOCR reader for English
        self.ocr_reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available())
        
        # Load YOLOv8 model (you'll need to train this on Indian number plates)
        model_path = os.path.join(os.path.dirname(__file__), 'models', 'indian_plates_yolov8.pt')
        if os.path.exists(model_path):
            self.yolo_model = YOLO(model_path)
        else:
            # Fallback to general object detection and filter for license plates
            self.yolo_model = YOLO('yolov8n.pt')
        
        # Indian number plate patterns
        self.indian_patterns = [
            # New BH series: BH01AB1234
            r'^BH\d{2}[A-Z]{2}\d{4}$',
            # Old format: MH01AB1234, KA01AB1234, etc.
            r'^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$',
            # Commercial vehicles: MH01A1234
            r'^[A-Z]{2}\d{2}[A-Z]\d{4}$',
            # Two-wheeler: MH01AB123
            r'^[A-Z]{2}\d{2}[A-Z]{2}\d{3}$'
        ]
        
        # Indian state codes for validation
        self.indian_states = {
            'AP': 'Andhra Pradesh', 'AR': 'Arunachal Pradesh', 'AS': 'Assam',
            'BR': 'Bihar', 'CG': 'Chhattisgarh', 'GA': 'Goa', 'GJ': 'Gujarat',
            'HR': 'Haryana', 'HP': 'Himachal Pradesh', 'JH': 'Jharkhand',
            'KA': 'Karnataka', 'KL': 'Kerala', 'MP': 'Madhya Pradesh',
            'MH': 'Maharashtra', 'MN': 'Manipur', 'ML': 'Meghalaya',
            'MZ': 'Mizoram', 'NL': 'Nagaland', 'OR': 'Odisha', 'PB': 'Punjab',
            'RJ': 'Rajasthan', 'SK': 'Sikkim', 'TN': 'Tamil Nadu',
            'TG': 'Telangana', 'TR': 'Tripura', 'UP': 'Uttar Pradesh',
            'UT': 'Uttarakhand', 'WB': 'West Bengal', 'AN': 'Andaman and Nicobar',
            'CH': 'Chandigarh', 'DN': 'Dadra and Nagar Haveli', 'DD': 'Daman and Diu',
            'DL': 'Delhi', 'JK': 'Jammu and Kashmir', 'LA': 'Ladakh',
            'LD': 'Lakshadweep', 'PY': 'Puducherry'
        }

    def detect_plates(self, image_path, frame_number):
        """Detect number plates in the image"""
        try:
            # Read image
            image = cv2.imread(image_path)
            if image is None:
                return []
            
            # Run YOLO detection
            results = self.yolo_model(image, conf=self.confidence_threshold)
            
            detected_plates = []
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # Get bounding box coordinates
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        confidence = box.conf[0].cpu().numpy()
                        
                        # Extract plate region
                        plate_region = image[int(y1):int(y2), int(x1):int(x2)]
                        
                        if plate_region.size > 0:
                            # Perform OCR on the plate region
                            plate_text = self.extract_text_from_plate(plate_region)
                            
                            if plate_text:
                                # Calculate timestamp based on frame number (assuming 30 FPS)
                                timestamp_seconds = frame_number / 30.0
                                timestamp = f"{int(timestamp_seconds // 60):02d}:{int(timestamp_seconds % 60):02d}"
                                
                                plate_data = {
                                    'plateNumber': plate_text,
                                    'confidence': float(confidence),
                                    'timestamp': timestamp,
                                    'frameNumber': frame_number,
                                    'boundingBox': {
                                        'x': int(x1),
                                        'y': int(y1),
                                        'width': int(x2 - x1),
                                        'height': int(y2 - y1)
                                    }
                                }
                                
                                detected_plates.append(plate_data)
            
            return detected_plates
            
        except Exception as e:
            print(f"Error detecting plates: {str(e)}", file=sys.stderr)
            return []

    def extract_text_from_plate(self, plate_image):
        """Extract text from number plate using OCR"""
        try:
            # Preprocess image for better OCR
            processed_image = self.preprocess_plate_image(plate_image)
            
            # Perform OCR
            results = self.ocr_reader.readtext(processed_image)
            
            # Extract and clean text
            text_parts = []
            for (bbox, text, confidence) in results:
                if confidence > 0.5:  # Filter low confidence text
                    cleaned_text = self.clean_plate_text(text)
                    if cleaned_text:
                        text_parts.append(cleaned_text)
            
            # Combine text parts
            full_text = ''.join(text_parts).upper()
            
            # Validate against Indian patterns
            if self.is_valid_indian_plate(full_text):
                return full_text
            
            return None
            
        except Exception as e:
            print(f"Error extracting text: {str(e)}", file=sys.stderr)
            return None

    def preprocess_plate_image(self, image):
        """Preprocess plate image for better OCR"""
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # Apply adaptive thresholding
            thresh = cv2.adaptiveThreshold(
                blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            
            # Morphological operations to clean up
            kernel = np.ones((2, 2), np.uint8)
            cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
            
            # Resize image for better OCR (if too small)
            height, width = cleaned.shape
            if height < 50 or width < 150:
                scale_factor = max(50/height, 150/width)
                new_width = int(width * scale_factor)
                new_height = int(height * scale_factor)
                cleaned = cv2.resize(cleaned, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
            
            return cleaned
            
        except Exception as e:
            print(f"Error preprocessing image: {str(e)}", file=sys.stderr)
            return image

    def clean_plate_text(self, text):
        """Clean and format extracted text"""
        # Remove special characters and spaces
        cleaned = re.sub(r'[^A-Z0-9]', '', text.upper())
        
        # Remove common OCR errors
        replacements = {
            'O': '0', 'I': '1', 'S': '5', 'Z': '2',
            'G': '6', 'B': '8', 'Q': '0'
        }
        
        # Apply replacements only for digits positions
        result = ""
        for i, char in enumerate(cleaned):
            if char in replacements and self.should_be_digit(cleaned, i):
                result += replacements[char]
            else:
                result += char
        
        return result

    def should_be_digit(self, text, position):
        """Determine if character at position should be a digit based on Indian plate patterns"""
        if len(text) >= 10:  # Standard format: XX00XX0000
            return position in [2, 3, 6, 7, 8, 9]
        elif len(text) >= 9:  # Two-wheeler: XX00XX000
            return position in [2, 3, 6, 7, 8]
        return False

    def is_valid_indian_plate(self, text):
        """Check if text matches Indian number plate patterns"""
        if not text or len(text) < 7:
            return False
        
        for pattern in self.indian_patterns:
            if re.match(pattern, text):
                # Additional validation for state codes
                if not text.startswith('BH'):
                    state_code = text[:2]
                    if state_code in self.indian_states:
                        return True
                else:
                    return True
        
        return False

def main():
    if len(sys.argv) != 5:
        print("Usage: python anpr_processor.py <image_path> <frame_number> <confidence_threshold> <processing_mode>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    frame_number = int(sys.argv[2])
    confidence_threshold = float(sys.argv[3])
    processing_mode = sys.argv[4]
    
    try:
        # Initialize processor
        processor = IndianANPRProcessor(confidence_threshold, processing_mode)
        
        # Detect plates
        plates = processor.detect_plates(image_path, frame_number)
        
        # Output results as JSON
        result = {
            'success': True,
            'plates': plates,
            'frame_number': frame_number
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'plates': []
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
