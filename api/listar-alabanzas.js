
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
        const folderId = '1xgpZiH5Ht1s22axOBq0NiisqxLaNDL1t';

        if (!apiKey) {
            return res.status(500).json({
                error: 'Falta configurar GOOGLE_DRIVE_API_KEY en Vercel'
            });
        }

        const params = new URLSearchParams({
            q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
            fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)',
            pageSize: '1000',
            orderBy: 'name',
            key: apiKey
        });

        const respuesta = await fetch(
            `https://www.googleapis.com/drive/v3/files?${params}`
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            console.error('Error de Google Drive:', datos);
            return res.status(respuesta.status).json({
                error: 'Google Drive no pudo devolver los archivos',
                detalle: datos.error?.message || 'Error desconocido'
            });
        }

        return res.status(200).json({
            success: true,
            total: datos.files?.length || 0,
            archivos: datos.files || [],
            siguientePagina: datos.nextPageToken || null
        });

    } catch (error) {
        console.error('Error al listar alabanzas:', error);

        return res.status(500).json({
            error: 'Error interno al consultar Google Drive'
        });
    }
}
