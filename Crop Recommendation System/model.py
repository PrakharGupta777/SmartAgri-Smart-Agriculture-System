# model.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
import numpy as np

app = Flask(__name__)
CORS(app)

# Load the trained model and label encoder
try:
    model_pipeline = joblib.load('xgboost_pipeline.pkl')
    label_encoder = joblib.load('label_encoder.pkl')
    print("✅ Machine Learning Model Loaded Successfully!")
except Exception as e:
    print(f"❌ Error loading model: {e}")

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()

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
            'Soil Type': data.get('soilType', ''),
            'Season': data.get('season', '')
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
            # We use float() to ensure it is JSON serializable and round to 2 decimal places
            confidence = float(round(probabilities[idx] * 100, 2))
            
            recommendations.append({
                "crop": crop_name,
                "confidence": confidence
            })
            
            # Print each of the top 5 to the terminal with clean formatting
            print(f"{i+1}. {crop_name}: {confidence:.2f}%")
        print("----------------------------------\n")
        
        # Return the list of top 5 to the frontend
        return jsonify({"recommendations": recommendations})

    except Exception as e:
        print(f"❌ Prediction Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Start the server on port 5000
    app.run(debug=True, port=5000)