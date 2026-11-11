
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        // ID fijo para esta primera prueba
        const fileId = '15QXZtSSAy0YkwWLcXkHskfOwkEoP6MpI';

        const headers = {};
        if (req.headers.range) {
            headers.Range = req.headers.range;
        }

        const respuesta = await fetch(
            `https://drive.google.com/uc?export=download&id=${fileId}`,
            {
                headers,
                redirect: 'follow'
            }
        );

        if (!respuesta.ok && respuesta.status !== 206) {
            return res.status(502).json({
                error: 'No se pudo obtener el PDF desde Google Drive',
                estado: respuesta.status
            });
        }

        const contenido = Buffer.from(
            await respuesta.arrayBuffer()
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Accept-Ranges', 'bytes');

        const contentRange = respuesta.headers.get('content-range');
        const contentLength = respuesta.headers.get('content-length');

        if (contentRange) {
            res.setHeader('Content-Range', contentRange);
        }

        if (contentLength) {
            res.setHeader('Content-Length', contenido.length);
        }

        return res.status(respuesta.status).send(contenido);

    } catch (error) {
        console.error('Error al abrir PDF:', error);

        return res.status(500).json({
            error: 'Error interno al obtener el PDF'
        });
    }
}
