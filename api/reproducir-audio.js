import { Readable } from 'node:stream';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Método no permitido'
        });
    }

    try {
        const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
        const audioId = req.query.id;

        if (!apiKey) {
            return res.status(500).json({
                error: 'Falta configurar GOOGLE_DRIVE_API_KEY en Vercel'
            });
        }

        if (
            typeof audioId !== 'string' ||
            !/^[a-zA-Z0-9_-]+$/.test(audioId)
        ) {
            return res.status(400).json({
                error: 'Identificador de audio inválido'
            });
        }

        const params = new URLSearchParams({
            alt: 'media',
            supportsAllDrives: 'true',
            key: apiKey
        });

        const encabezados = {};

        if (req.headers.range) {
            encabezados.Range = req.headers.range;
        }

        const respuesta = await fetch(
            `https://www.googleapis.com/drive/v3/files/${audioId}?${params}`,
            {
                method: 'GET',
                headers: encabezados
            }
        );

        if (!respuesta.ok) {
            const detalle = await respuesta.text();

            console.error('Error de Google Drive:', detalle);

            return res.status(respuesta.status).json({
                error: 'No se pudo obtener el audio de Google Drive',
                detalle
            });
        }

        res.statusCode = respuesta.status;

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader(
            'Cache-Control',
            'public, max-age=3600'
        );

        const encabezadosCopiar = [
            'content-length',
            'content-range'
        ];

        for (const nombre of encabezadosCopiar) {
            const valor = respuesta.headers.get(nombre);

            if (valor) {
                res.setHeader(nombre, valor);
            }
        }

        if (!respuesta.body) {
            return res.end();
        }

        Readable.fromWeb(respuesta.body).pipe(res);

    } catch (error) {
        console.error('Error al reproducir audio:', error);

        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Error interno al reproducir el audio'
            });
        }

        res.end();
    }
}
