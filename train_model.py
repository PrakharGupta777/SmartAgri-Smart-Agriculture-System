# train_model.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import joblib

print("⏳ Loading dataset...")
# Load the new dataset
df = pd.read_csv("merged_crop_dataset.csv")

print("🧹 Preparing data...")
# Drop any potential empty rows
df = df.dropna()

# 1. Define Features (X) and Target (y)
# The target column in the new dataset is 'label'
X = df.drop(columns=['label'])
y = df['label']

# Encode the target crop labels into numbers
label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)

# 2. Build the Pipeline
# Since all features (N, P, K, temperature, humidity, ph, rainfall) are numeric now,
# we no longer need the OneHotEncoder or ColumnTransformer.
model_pipeline = Pipeline(steps=[
    ('classifier', RandomForestClassifier(
        n_estimators=200, 
        max_depth=12,         # Restrict depth to force generalization
        random_state=42
    ))
])

# 3. Split the data into Training and Testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42)

print("🧠 Training Model...")
model_pipeline.fit(X_train, y_train)

# 4. Evaluate the model
y_pred = model_pipeline.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"✅ Training Complete! Model Accuracy: {accuracy * 100:.2f}%")

# 5. Save the trained model and encoder
# Saving as 'xgboost_pipeline.pkl' so it seamlessly integrates with your existing model.py backend
print("💾 Saving files...")
joblib.dump(model_pipeline, 'random_forest_pipeline.pkl')
joblib.dump(label_encoder, 'label_encoder.pkl')

print("🚀 All Done! You can now start the Flask server.")