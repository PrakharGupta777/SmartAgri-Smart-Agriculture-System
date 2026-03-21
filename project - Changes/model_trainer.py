import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import xgboost as xgb
import pickle
import os

def train_best_crop_model(file_path):
    """
    Trains a high-performance XGBoost model for crop recommendation.
    Includes feature alignment to handle one-hot encoding during production.
    """
    if not os.path.exists(file_path):
        print(f"Error: Dataset '{file_path}' not found.")
        return None

    try:
        # 1. Load the dataset
        print(f"Loading data from {file_path}...")
        df = pd.read_csv(file_path)

        # 2. Preprocessing
        # Fix column names if they have trailing spaces (common in CSVs)
        df.columns = df.columns.str.strip()
        
        # Target encoding
        le_crop = LabelEncoder()
        df['Crop_Encoded'] = le_crop.fit_transform(df['Crop Name'])
        
        # One-Hot Encoding for Soil Types
        # Note: In production, we must ensure the same columns exist even if a specific soil isn't in the input
        df_encoded = pd.get_dummies(df, columns=['Best Soil Types (India)'], prefix='Soil')
        
        # Identify base features and encoded soil features
        base_features = ['N (kg/ha)', 'P (kg/ha)', 'K (kg/ha)', 'Temp (°C)', 'Rain (mm)', 'Hum (%)', 'pH']
        soil_cols = [col for col in df_encoded.columns if col.startswith('Soil_')]
        all_features = base_features + soil_cols
        
        X = df_encoded[all_features]
        y = df_encoded['Crop_Encoded']

        # 3. Split the data
        # Using stratify ensures each crop type is represented in both sets
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # 4. Feature Scaling
        # Even though XGBoost handles unscaled data, scaling improves convergence and pipeline consistency
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        # 5. Initialize and train XGBoost
        # Optimization: increased estimators and tuned learning rate
        print("Training Optimized XGBoost model...")
        best_model = xgb.XGBClassifier(
            n_estimators=500,
            learning_rate=0.03,
            max_depth=7,
            min_child_weight=1,
            gamma=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            objective='multi:softprob',
            random_state=42,
            n_jobs=-1,
            eval_metric='mlogloss'
        )
        
        best_model.fit(X_train_scaled, y_train)

        # 6. Evaluation
        y_pred = best_model.predict(X_test_scaled)
        accuracy = accuracy_score(y_test, y_pred)
        
        # Cross-Validation
        print("Running Cross-Validation...")
        cv_scores = cross_val_score(best_model, X_train_scaled, y_train, cv=5)
        
        print("-" * 45)
        print(f"XGBoost Holdout Accuracy: {accuracy * 100:.2f}%")
        print(f"5-Fold CV Mean Accuracy: {cv_scores.mean() * 100:.2f}% (+/- {cv_scores.std()*100:.1f}%)")
        print("-" * 45)
        
        print("\nDetailed Performance Report:")
        print(classification_report(y_test, y_pred, target_names=le_crop.classes_))

        # 7. Save Comprehensive Model Payload
        # We save 'all_features' so the inference script knows the exact column order
        model_payload = {
            'model': best_model,
            'scaler': scaler,
            'le_crop': le_crop,
            'feature_names': all_features,
            'soil_categories': soil_cols
        }
        
        save_path = 'best_crop_model.pkl'
        with open(save_path, 'wb') as f:
            pickle.dump(model_payload, f)
        
        print(f"\nModel bundle saved successfully to '{save_path}'")
        return best_model

    except Exception as e:
        print(f"An error occurred during training: {str(e)}")
        return None

if __name__ == "__main__":
    # Example usage: Replace with your actual CSV path
    train_best_crop_model('crop_recommend_dataset.csv')