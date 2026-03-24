# model.py
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
import joblib
import numpy as np
import os

# 1. Configure Flask to serve static files from the current directory
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Load the trained model and label encoder
try:
    model_pipeline = joblib.load('xgboost_pipeline.pkl')
    label_encoder = joblib.load('label_encoder.pkl')
    print("✅ Machine Learning Model Loaded Successfully!")
except Exception as e:
    print(f"❌ Error loading model: {e}")

# 2. Serve the index.html file at the root URL
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()

    # --- NEW: Print the incoming parameters to the terminal ---
    print("\n" + "="*40)
    print("🌱 NEW PREDICTION REQUEST RECEIVED 🌱")
    print("="*40)
    print(f"Nitrogen (N)  : {data.get('nitrogen', 0)} kg/ha")
    print(f"Phosphorus (P): {data.get('phosphorus', 0)} kg/ha")
    print(f"Potassium (K) : {data.get('potassium', 0)} kg/ha")
    print(f"Temperature   : {data.get('temperature', 0)} °C")
    print(f"Rainfall      : {data.get('rainfall', 0)} mm")
    print(f"Humidity      : {data.get('humidity', 0)} %")
    print(f"pH Level      : {data.get('ph', 0)}")
    print(f"Soil Type     : {data.get('soilType', 'N/A')}")
    print(f"Season        : {data.get('season', 'N/A')}")
    print("-" * 40)
    # ----------------------------------------------------------

    try:
        # 1. Format incoming JSON into DataFrame
        input_df = pd.DataFrame([{
            'N (kg/ha)': float(data.get('nitrogen', 0)),
            'P (kg/ha)': float(data.get('phosphorus', 0)),
            'K (kg/ha)': float(data.get('potassium', 0)),
            'Temp (°C)': float(data.get('temperature', 0)),
            'Rain (mm)': float(data.get('rainfall', 0)),
            'Hum (%)': float(data.get('humidity', 0)),
            'pH': float(data.get('ph', 0)),
            'Soil Type': data.get('soilType', '').strip().title(),
            'Season': data.get('season', '').strip().title()
        }])

        # 2. Get probabilities for ALL classes
        probabilities = model_pipeline.predict_proba(input_df)[0]
        
        # 3. Get the indices of the top 5 highest probabilities
        top_indices = np.argsort(probabilities)[-5:][::-1]

        # 4. Map indices to crop names and confidence scores
        recommendations = []
        print("\n--- TOP 5 CROP RECOMMENDATIONS ---")
        for i, idx in enumerate(top_indices):
            crop_name = str(label_encoder.inverse_transform([idx])[0])
            
            # Calculate and round the confidence score
            confidence = float(round(probabilities[idx] * 100, 2))
            
            recommendations.append({
                "crop": crop_name,
                "confidence": confidence
            })
            
            # Print each of the top 5 to the terminal with clean formatting
            print(f"{i+1}. {crop_name}: {confidence:.2f}%")
        print("========================================\n")
        
        # Return the list of top 5 to the frontend
        return jsonify({"recommendations": recommendations})

    except Exception as e:
        print(f"❌ Prediction Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Start the server on port 5000
    print("🌐 Server starting! Open http://127.0.0.1:5000 in your browser.")
    app.run(debug=True, port=5000)