const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

// Escucha cada nuevo mensaje creado desde tu paneladmin.html
exports.enviarNotificacionPush = onDocumentCreated("cola_notificaciones/{docId}", async (event) => {
    const snap = event.data;
    if (!snap) return;
    
    const data = snap.data();
    const titulo = data.title;
    const mensaje = data.body;
    const destino = data.click_action || "index.html";

    try {
        // 1. Obtener todos los tokens guardados en la base de datos
        const tokensSnapshot = await admin.firestore().collection("fcm_tokens").get();
        const tokens = [];
        
        tokensSnapshot.forEach(doc => {
            const tokenData = doc.data();
            if (tokenData.token) {
                tokens.push(tokenData.token);
            }
        });

        if (tokens.length === 0) {
            console.log("No hay dispositivos suscriptos para notificar.");
            return;
        }

        // 2. Armar el paquete de la notificación push
        const payload = {
            notification: {
                title: titulo,
                body: mensaje
            },
            webpush: {
                fcmOptions: {
                    link: destino
                }
            },
            tokens: tokens
        };

        // 3. Enviar a todos los dispositivos registrados
        const response = await admin.messaging().sendEachForMulticast(payload);
        console.log(`Notificaciones enviadas con éxito: ${response.successCount}`);

        // Limpieza automática de tokens viejos o desinstalados
        if (response.failureCount > 0) {
            response.responses.forEach(async (resp, idx) => {
                if (!resp.success) {
                    const tokenFallido = tokens[idx];
                    console.log(`Eliminando token inválido: ${tokenFallido}`);
                    await admin.firestore().collection("fcm_tokens").doc(tokenFallido).delete();
                }
            });
        }

    } catch (error) {
        console.error("Error al enviar notificaciones push:", error);
    }
});
