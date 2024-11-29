// En la función de envío de datos
void enviarDatos(float cantidadPlato, float cantidadDispensador) {
    if (WiFi.status() == WL_CONNECTED) {
        WiFiClientSecure client;
        client.setInsecure();
        HTTPClient http;
        
        if (http.begin(client, serverUrl)) {
            http.addHeader("Content-Type", "application/json");
            
            // Crear JSON con ambos valores
            String jsonData = "{\"cantidadPlato\":" + String(cantidadPlato) + 
                            ",\"cantidadDispensador\":" + String(cantidadDispensador) + "}";
            
            int httpCode = http.POST(jsonData);
            
            if (httpCode > 0) {
                String response = http.getString();
                Serial.println("Datos enviados correctamente");
            }
            
            http.end();
        }
    }
} 