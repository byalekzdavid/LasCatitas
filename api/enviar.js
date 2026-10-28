import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Inicializar Firebase Admin de forma segura en Vercel
if (!getApps().length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        initializeApp({
            credential: cert(serviceAccount)
        });
    } catch (e) {
        console.error("Error al parsear FIREBASE_SERVICE_ACCOUNT_JSON:", e);
    }
}

export default async function handler(req, res) {
    // Permitir CORS para que GitHub Pages pueda comunicarse con Vercel sin bloqueos
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responder de inmediato a las peticiones de verificación del navegador (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Permitir verificación rápida mediante GET en el navegador
    if (req.method === 'GET') {
        return res.status(200).json({ estado: "API de notificaciones de Las Catitas activa y funcionando correctamente." });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { titulo, cuerpo, click_action } = req.body;

        if (!titulo || !cuerpo) {
            return res.status(400).json({ error: 'Faltan el título o el cuerpo de la notificación' });
        }

        const db = getFirestore();
        const messaging = getMessaging();

        // Obtener todos los tokens de los dispositivos suscritos desde Firestore
        const tokensSnapshot = await db.collection('fcm_tokens').get();
        
        if (tokensSnapshot.empty) {
            return res.status(200).json({ mensaje: 'No hay dispositivos suscritos.', enviados: 0 });
        }

        const tokens = [];
        tokensSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.token) tokens.push(data.token);
        });

        if (tokens.length === 0) {
            return res.status(200).json({ mensaje: 'No hay tokens válidos.', enviados: 0 });
        }

        // Construir el mensaje compatible con multicast y webpush
        const message = {
            tokens: tokens,
            notification: {
                title: titulo,
                body: cuerpo
            },
            webpush: {
                notification: {
                    title: titulo,
                    body: cuerpo,
                    icon: './icons/icon-192.png',
                    click_action: click_action || './index.html'
                },
                fcmOptions: {
                    link: click_action || './index.html'
                }
            }
        };

        // Enviar notificaciones masivas
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
