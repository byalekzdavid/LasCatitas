
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
        const carpetaPrincipal = '1LreOvQMNi23byi7P72RMB5DSmDqUyBX8';

        if (!apiKey) {
            return res.status(500).json({
                error: 'Falta configurar GOOGLE_DRIVE_API_KEY en Vercel'
            });
        }

        // Consultar el contenido de una carpeta.
        async function listarCarpeta(folderId) {
            let archivos = [];
            let pageToken = null;

            do {
                const params = new URLSearchParams({
                    q: `'${folderId}' in parents and trashed = false`,
                    fields: 'nextPageToken,files(id,name,mimeType)',
                    pageSize: '1000',
                    orderBy: 'name',
                    supportsAllDrives: 'true',
                    includeItemsFromAllDrives: 'true',
                    key: apiKey
                });

                if (pageToken) {
                    params.set('pageToken', pageToken);
                }

                const respuesta = await fetch(
                    `https://www.googleapis.com/drive/v3/files?${params}`
                );

                const datos = await respuesta.json();

                if (!respuesta.ok) {
                    throw new Error(
                        datos.error?.message || 'Error al consultar Google Drive'
                    );
                }

                archivos.push(...(datos.files || []));
                pageToken = datos.nextPageToken || null;

            } while (pageToken);

            return archivos;
        }

        // Obtener las categorías.
        const elementos = await listarCarpeta(carpetaPrincipal);

        const carpetas = elementos.filter(
            archivo => archivo.mimeType === 'application/vnd.google-apps.folder'
        );

        const categorias = [];

        // Obtener los MP3 de cada categoría.
        for (const carpeta of carpetas) {
            const archivos = await listarCarpeta(carpeta.id);

            const audios = archivos
                .filter(archivo =>
                    archivo.mimeType === 'audio/mpeg' ||
                    archivo.name.toLowerCase().endsWith('.mp3')
                )
                .map(audio => ({
                    id: audio.id,
                    nombre: audio.name
                }));

            categorias.push({
                id: carpeta.id,
                nombre: carpeta.name,
                audios
            });
        }

        return res.status(200).json({
            success: true,
            totalCategorias: categorias.length,
            totalAudios: categorias.reduce(
                (total, categoria) => total + categoria.audios.length,
                0
            ),
            categorias
        });

    } catch (error) {
        console.error('Error al listar audios:', error);

        return res.status(500).json({
            error: 'Error al consultar los audios de Google Drive',
            detalle: error.message
        });
    }
}
