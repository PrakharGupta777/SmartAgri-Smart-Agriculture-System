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
    Strictly aligned with crop_recommend_dataset.csv and the Frontend UI.
    """
    if not os.path.exists(file_path):
        print(f"Error: Dataset '{file_path}' not found.")
        return None

    try:
        # 1. Load the dataset
        print(f"Loading data from {file_path}...")
        df = pd.read_csv(file_path)

        # 2. Preprocessing & UI Alignment
        df.columns = df.columns.str.strip()
        
        if 'ID' in df.columns:
            df = df.drop('ID', axis=1)
            
        # --- API & UI ALIGNMENT BLOCK ---
        # Rename columns to exactly match the JSON keys from your UI (index.html)
        # This also removes special characters like (°C) which crash XGBoost
        rename_map = {
            'N (kg/ha)': 'n',
            'P (kg/ha)': 'p',
            'K (kg/ha)': 'k',
            'Temp (°C)': 'temp',
            'Rain (mm)': 'rain',
            'Hum (%)': 'hum',
            'pH': 'ph',
            'Soil Type': 'soil',
            'Season': 'season',
            'Crop Name': 'crop'
        }
        df = df.rename(columns=rename_map)
        
        # A. Map Soil Types
        # The CSV uses "Black", but the UI uses "Black (Regur)"
        df['soil'] = df['soil'].replace({'Black': 'Black (Regur)'})
        
        # B. Map Seasons
        # The CSV has mixed seasons (e.g., "Kharif/Rabi", "Perennial (Fruiting: Summer)")
        # We extract the primary season to match the 4 UI options
        def clean_season(s):
            s_lower = str(s).lower()
            if 'perennial' in s_lower: return 'Perennial'
            elif 'kharif' in s_lower: return 'Kharif'
            elif 'rabi' in s_lower: return 'Rabi'
            elif 'zaid' in s_lower: return 'Zaid'
            return 'Kharif' # Safe fallback
            
        df['season'] = df['season'].apply(clean_season)
        # ---------------------------
        
        # Target encoding for 'Crop Name'
        le_crop = LabelEncoder()
        df['Crop_Encoded'] = le_crop.fit_transform(df['crop'])
        
        # One-Hot Encoding for 'soil' AND 'season'
        df_encoded = pd.get_dummies(df, columns=['soil', 'season'], prefix=['soil', 'season'])
        
        # Identify base numerical features matching the UI inputs exactly
        base_features = ['n', 'p', 'k', 'temp', 'rain', 'hum', 'ph']
        
        soil_cols = [col for col in df_encoded.columns if col.startswith('soil_')]
        season_cols = [col for col in df_encoded.columns if col.startswith('season_')]
        
        # Combine all features to maintain strict column order
        all_features = base_features + soil_cols + season_cols
        
        X = df_encoded[all_features]
        y = df_encoded['Crop_Encoded']

        # 3. Split the data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # 4. Feature Scaling
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        # 5. Initialize and train XGBoost
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
        
        print("Running Cross-Validation...")
        cv_scores = cross_val_score(best_model, X_train_scaled, y_train, cv=5)
        
        print("-" * 45)
        print(f"XGBoost Holdout Accuracy: {accuracy * 100:.2f}%")
        print(f"5-Fold CV Mean Accuracy: {cv_scores.mean() * 100:.2f}% (+/- {cv_scores.std()*100:.1f}%)")
        print("-" * 45)
        
        # 7. Save Comprehensive Model Payload
        model_payload = {
            'model': best_model,
            'scaler': scaler,
            'le_crop': le_crop,
            'feature_names': all_features,
            'soil_categories': soil_cols,
            'season_categories': season_cols
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
    train_best_crop_model('crop_recommend_dataset.csv')