import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const ORIGEN_PERMITIDO = 'https://byalekzdavid.github.io';
const URL_PUBLICA = 'https://byalekzdavid.github.io/LasCatitas/';

function obtenerAppFirebase() {
  if (getApps().length) return getApps()[0];

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error('Falta la configuración de Firebase.');

  const cuenta = JSON.parse(json);
  return initializeApp({ credential: cert(cuenta) });
}

export default async function handler(req, res) {
  const origen = req.headers.origin;

  res.setHeader('Vary', 'Origin');

  if (origen === ORIGEN_PERMITIDO) {
    res.setHeader('Access-Control-Allow-Origin', ORIGEN_PERMITIDO);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (origen && origen !== ORIGEN_PERMITIDO) {
    return res.status(403).json({ error: 'Origen no permitido.' });
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      estado: 'API de notificaciones de Las Catitas activa.'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const autorizacion = req.headers.authorization || '';
    const coincidencia = autorizacion.match(/^Bearer\s+(.+)$/i);

    if (!coincidencia) {
      return res.status(401).json({
        error: 'Debes iniciar sesión como administrador.'
      });
    }

    const app = obtenerAppFirebase();
    const auth = getAuth(app);

    const usuario = await auth.verifyIdToken(coincidencia[1], true);

    const documento = await getFirestore(app)
      .collection('usuarios')
      .doc(usuario.uid)
      .get();

    if (
      !documento.exists ||
      documento.data().rol !== 'administrador' ||
      documento.data().activo !== true
    ) {
      return res.status(403).json({
        error: 'La cuenta no tiene permisos de administrador.'
      });
    }

    const { titulo, cuerpo, click_action } = req.body || {};

    if (
      typeof titulo !== 'string' ||
      typeof cuerpo !== 'string' ||
      !titulo.trim() ||
      !cuerpo.trim() ||
      titulo.length > 60 ||
      cuerpo.length > 220
    ) {
      return res.status(400).json({
        error: 'El título o el mensaje están vacíos o superan el límite permitido.'
      });
    }

    const destinosPermitidos = ['index.html', 'audios.html'];
    const destino = destinosPermitidos.includes(click_action)
      ? click_action
      : 'index.html';

    const db = getFirestore(app);
    const messaging = getMessaging(app);

    const snapshot = await db.collection('fcm_tokens').get();
    const tokens = [
      ...new Set(
        snapshot.docs
          .map(doc => doc.data().token)
          .filter(token => typeof token === 'string' && token.length > 0)
      )
    ];

    if (tokens.length === 0) {
      return res.status(200).json({
        success: true,
        enviados: 0,
        fallidos: 0,
        mensaje: 'No hay dispositivos registrados con tokens.'
      });
    }

    let enviados = 0;
    let fallidos = 0;
    const errores = {};

    // Firebase permite un máximo de 500 tokens por envío multicast.
    for (let i = 0; i < tokens.length; i += 500) {
      const grupo = tokens.slice(i, i + 500);

      const mensaje = {
        tokens: grupo,
        notification: {
          title: titulo.trim(),
          body: cuerpo.trim()
        },
        webpush: {
          notification: {
            title: titulo.trim(),
            body: cuerpo.trim(),
            icon: `${URL_PUBLICA}icons/icon-192.png`
          },
          fcmOptions: {
            link: `${URL_PUBLICA}${destino}`
          }
        }
      };

      const respuesta = await messaging.sendEachForMulticast(mensaje);

      enviados += respuesta.successCount;
      fallidos += respuesta.failureCount;

      for (const resultado of respuesta.responses) {
        if (!resultado.success) {
          const codigo =
            resultado.error?.code || 'error-desconocido';

          errores[codigo] = (errores[codigo] || 0) + 1;
        }
      }
    }

    // Nunca registrar ni devolver los tokens de los dispositivos.
    console.info('Resultado FCM:', JSON.stringify({
      total: tokens.length,
      enviados,
      fallidos,
      errores
    }));

    return res.status(200).json({
      success: fallidos === 0 && enviados > 0,
      enviados,
      fallidos,
      errores
    });

  } catch (error) {
    // Registrar solo el código del error, nunca credenciales ni tokens.
    console.error('Error en API de notificaciones:', {
      codigo: error.code || 'error-interno'
    });

    if (
      error.code === 'auth/argument-error' ||
      error.code === 'auth/id-token-expired' ||
      error.code === 'auth/id-token-revoked' ||
      error.code === 'auth/invalid-id-token'
    ) {
      return res.status(401).json({
        error: 'La sesión no es válida o ha caducado. Vuelve a iniciar sesión.'
      });
    }

    return res.status(500).json({
      error: 'No se pudo completar el envío. Revisa los registros de Vercel.'
    });
  }
}
