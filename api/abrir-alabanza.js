
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

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
        const folderId = '1xgpZiH5Ht1s22axOBq0NiisqxLaNDL1t';
        const fileId = req.query.id;

        if (!apiKey) {
            return res.status(500).json({
                error: 'Falta configurar GOOGLE_DRIVE_API_KEY'
            });
        }

        if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
            return res.status(400).json({
                error: 'ID de archivo inválido'
            });
        }

        // Comprobar que el archivo pertenece a nuestra biblioteca.
        const metadataURL = new URL(
            `https://www.googleapis.com/drive/v3/files/${fileId}`
        );

        metadataURL.searchParams.set(
            'fields',
            'id,mimeType,parents'
        );
        metadataURL.searchParams.set('key', apiKey);

        const metadataResponse = await fetch(metadataURL);

        if (!metadataResponse.ok) {
            return res.status(404).json({
                error: 'No se encontró el archivo'
            });
        }

        const metadata = await metadataResponse.json();

        if (
            metadata.mimeType !== 'application/pdf' ||
            !metadata.parents?.includes(folderId)
        ) {
            return res.status(403).json({
                error: 'El archivo no pertenece a la biblioteca'
            });
        }

        // Obtener el contenido del PDF desde Drive.
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
                error: 'No se pudo obtener el PDF desde Google Drive'
            });
        }

        const contenido = Buffer.from(
            await respuesta.arrayBuffer()
        );

        // Comprobar que la respuesta contiene realmente un PDF.
        if (contenido.subarray(0, 5).toString() !== '%PDF-') {
            return res.status(502).json({
                error: 'Google Drive no devolvió un PDF válido'
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Content-Length', contenido.length);

        if (respuesta.status === 206) {
            res.setHeader('Accept-Ranges', 'bytes');

            const contentRange =
                respuesta.headers.get('content-range');

            if (contentRange) {
                res.setHeader('Content-Range', contentRange);
            }
        }

        return res.status(respuesta.status).send(contenido);

    } catch (error) {
        console.error('Error al abrir PDF:', error);

        return res.status(500).json({
            error: 'Error interno al obtener el PDF'
        });
    }
}
