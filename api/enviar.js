import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Inicializar Firebase Admin de forma segura en Vercel
if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();
const messaging = getMessaging();

export default async function handler(req, res) {
    // Permitir solo peticiones POST
    if (req.method !== 'POST') {
        return res.status(405.json({ error: 'Método no permitido' }));
    }

    try {
        const { titulo, cuerpo } = req.body;

        if (!titulo || !cuerpo) {
            return res.status(400).json({ error: 'Faltan el título o el cuerpo de la notificación' });
        }

        // 1. Obtener todos los tokens desde Firestore
        const tokensSnapshot = await db.collection('fcm_tokens').get();
        
        if (tokensSnapshot.empty) {
            return res.status(200).json({ mensaje: 'No hay dispositivos suscritos.' });
        }

        const tokens = [];
        tokensSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.token) tokens.push(data.token);
        });

        if (tokens.length === 0) {
            return res.status(200).json({ mensaje: 'No hay tokens válidos.' });
        }

        // 2. Construir el mensaje masivo
        const message = {
            notification: {
                title: titulo,
                body: cuerpo
            },
            tokens: tokens
        };

        // 3. Enviar a través de Firebase Cloud Messaging
        const response = await messaging.sendEachForMulticast(message);

        return res.status(200).json({ 
            success: true, 
            enviados: response.successCount, 
            fallidos: response.failureCount 
        });

    } catch (error) {
        console.error('Error al enviar notificaciones:', error);
        return res.status(500).json({ error: error.message });
    }
}
