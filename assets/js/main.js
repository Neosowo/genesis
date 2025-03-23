// Configuración de la conexión WebSocket
const ws = new WebSocket('ws://localhost:8080');

// Configuración para polling (fallback)
const POLLING_INTERVAL = 5000; // 5 segundos

class RealtimeDB {
    constructor() {
        this.listeners = new Map();
        this.isWebSocketActive = false;
        this.setupWebSocket();
    }

    // Configurar WebSocket
    setupWebSocket() {
        ws.onopen = () => {
            console.log('WebSocket conectado');
            this.isWebSocketActive = true;
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.notifyListeners(data);
        };

        ws.onerror = (error) => {
            console.error('Error de WebSocket:', error);
            this.isWebSocketActive = false;
            this.startPolling();
        };

        ws.onclose = () => {
            console.log('WebSocket desconectado');
            this.isWebSocketActive = false;
            this.startPolling();
        };
    }

    // Método para realizar consultas HTTP
    async fetchData(columnName) {
        try {
            const response = await fetch(`/api/data/${columnName}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error al obtener datos:', error);
            throw error;
        }
    }

    // Iniciar polling como fallback
    startPolling() {
        if (!this.isWebSocketActive) {
            this.pollingInterval = setInterval(async () => {
                try {
                    // Obtener datos actualizados para cada columna registrada
                    for (const [columnName, callbacks] of this.listeners) {
                        const data = await this.fetchData(columnName);
                        this.notifyListeners({ columnName, data });
                    }
                } catch (error) {
                    console.error('Error en polling:', error);
                }
            }, POLLING_INTERVAL);
        }
    }

    // Registrar un listener para una columna específica
    subscribe(columnName, callback) {
        if (!this.listeners.has(columnName)) {
            this.listeners.set(columnName, new Set());
            
            // Enviar mensaje de suscripción por WebSocket
            if (this.isWebSocketActive) {
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    columnName
                }));
            }
        }
        
        this.listeners.get(columnName).add(callback);
        
        // Obtener datos iniciales
        this.fetchData(columnName)
            .then(data => callback(data))
            .catch(error => console.error('Error al obtener datos iniciales:', error));
    }

    // Eliminar un listener
    unsubscribe(columnName, callback) {
        if (this.listeners.has(columnName)) {
            this.listeners.get(columnName).delete(callback);
            
            if (this.listeners.get(columnName).size === 0) {
                this.listeners.delete(columnName);
                
                // Enviar mensaje de desuscripción por WebSocket
                if (this.isWebSocketActive) {
                    ws.send(JSON.stringify({
                        type: 'unsubscribe',
                        columnName
                    }));
                }
            }
        }
    }

    // Notificar a todos los listeners registrados
    notifyListeners(data) {
        const { columnName, value } = data;
        if (this.listeners.has(columnName)) {
            this.listeners.get(columnName).forEach(callback => callback(value));
        }
    }

    // Limpiar recursos
    cleanup() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        if (ws) {
            ws.close();
        }
        this.listeners.clear();
    }
}

// Ejemplo de uso
const realtimeDB = new RealtimeDB();

// Suscribirse a actualizaciones de una columna
function subscribeToColumn(columnName) {
    realtimeDB.subscribe(columnName, (value) => {
        // Actualizar la UI con el nuevo valor
        updateUI(columnName, value);
    });
}

// Función para actualizar la UI
function updateUI(columnName, value) {
    const element = document.getElementById(columnName);
    if (element) {
        element.textContent = value;
    }
}

// Ejemplo de implementación
document.addEventListener('DOMContentLoaded', () => {
    // Suscribirse a actualizaciones de la columna 'precio'
    subscribeToColumn('precio');
    
    // Limpiar recursos cuando la página se cierre
    window.addEventListener('beforeunload', () => {
        realtimeDB.cleanup();
    });
});