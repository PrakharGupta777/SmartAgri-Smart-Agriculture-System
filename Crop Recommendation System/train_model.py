# train_model.py
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score
import joblib

print("⏳ Loading dataset...")
# 1. Load the dataset
df = pd.read_csv("crop_recommend_dataset.csv")

# 2. Separate features (X) and target (y)
# We drop 'ID' because it's not a predictive feature
X = df.drop(columns=['ID', 'Crop Name'])
y = df['Crop Name']

# 3. Encode the target labels (Crop Names -> Numbers)
label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)

# 4. Define categorical and numerical columns
categorical_cols = ['Soil Type', 'Season']
numeric_cols = ['N (kg/ha)', 'P (kg/ha)', 'K (kg/ha)', 'Temp (°C)', 'Rain (mm)', 'Hum (%)', 'pH']

# 5. Create a preprocessor to One-Hot Encode the text columns (Soil, Season)
preprocessor = ColumnTransformer(
    transformers=[
        ('num', 'passthrough', numeric_cols),
        ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_cols)
    ])

# 6. Build the Pipeline: Preprocessing -> XGBoost
model_pipeline = Pipeline(steps=[
    ('preprocessor', preprocessor),
    ('classifier', xgb.XGBClassifier(
        n_estimators=100, 
        learning_rate=0.1,
        max_depth=6,
        random_state=42, 
        eval_metric='mlogloss'
    ))
])

# 7. Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42)

print("🧠 Training XGBoost Model...")
# 8. Train the model
model_pipeline.fit(X_train, y_train)

# 9. Test the accuracy
y_pred = model_pipeline.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"✅ Model trained successfully! Accuracy: {accuracy * 100:.2f}%")

# 10. Save the pipeline and the label encoder to files
joblib.dump(model_pipeline, 'xgboost_pipeline.pkl')
joblib.dump(label_encoder, 'label_encoder.pkl')
print("💾 Model saved as 'xgboost_pipeline.pkl' and 'label_encoder.pkl'")