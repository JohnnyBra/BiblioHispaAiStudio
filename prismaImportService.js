import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Intentar cargar .env, pero no depender de ello si ya está cargado por el server
dotenv.config();

const PRISMA_BASE_URL = process.env.PRISMA_API_URL || 'https://prisma.bibliohispa.es';

// NOTA: Eliminamos la exportación de API_SECRET para evitar el error de carga temprana

async function fetchFromPrisma(endpoint) {
    // Limpiar URL base
    const baseUrl = PRISMA_BASE_URL.endsWith('/') ? PRISMA_BASE_URL.slice(0, -1) : PRISMA_BASE_URL;
    const url = `${baseUrl}${endpoint}`;

    // LEER EL SECRETO AQUÍ (En tiempo de ejecución)
    // Buscamos ambas variables para máxima compatibilidad
    const secret = process.env.PRISMA_API_SECRET || process.env.API_SECRET;

    if (!secret || secret === 'YOUR_API_SECRET') {
        console.warn(`[ImportService] ALERTA: PRISMA_API_SECRET (o API_SECRET) parece incorrecto o por defecto: ${secret}`);
    }

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'BiblioHispa-Server/1.0',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'api_secret': secret,
                'x-api-secret': secret,
                'Authorization': `Bearer ${secret}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error(`403 Forbidden: El secreto enviado fue rechazado. (Secreto usado empieza por: ${secret ? secret.substring(0,3) : 'NULO'}...)`);
            }
            if (response.status === 500) {
                throw new Error('500 Internal Server Error: Error remoto en PrismaEdu');
            }
            const text = await response.text();
            throw new Error(`Error ${response.status}: ${text}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`[ImportService] Error fetching ${endpoint}:`, error.message);
        throw error;
    }
}

function splitName(fullName) {
    if (!fullName) return { firstName: '', lastName: '' };
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    return { firstName, lastName };
}

export async function getAcademicData() {
    try {
        console.log('[ImportService] Iniciando importación de datos...');
        
        // Verificar entorno antes de empezar
        const secret = process.env.PRISMA_API_SECRET || process.env.API_SECRET;
        if (!secret) {
            throw new Error("PRISMA_API_SECRET (o API_SECRET) no está definido en el entorno");
        }

        const [classesRaw, studentsRaw, teachersRaw] = await Promise.all([
            fetchFromPrisma('/api/export/classes'),
            fetchFromPrisma('/api/export/students'),
            fetchFromPrisma('/api/export/users')
        ]);

        const classes = classesRaw.map(c => ({
            id: c.id,
            name: c.name,
            stage: c.stage,
            cycle: c.cycle,
            level: c.level
        }));

        const students = studentsRaw.map(s => {
            const { firstName, lastName } = splitName(s.name);
            return {
                id: String(s.id),
                firstName,
                lastName,
                username: s.email ? s.email.split('@')[0] : firstName.toLowerCase(),
                email: s.email,
                classId: s.classId,
                familyId: s.familyId,
                role: 'STUDENT',
                isExternal: true
            };
        });

        const teachers = teachersRaw.map(t => {
            const { firstName, lastName } = splitName(t.name);
            return {
                id: String(t.id),
                firstName,
                lastName,
                username: t.email ? t.email.split('@')[0] : firstName.toLowerCase(),
                email: t.email,
                classId: t.classId,
                role: 'TUTOR',
                isExternal: true
            };
        });

        console.log(`[ImportService] Importado: ${classes.length} clases, ${students.length} alumnos, ${teachers.length} profesores.`);

        return { classes, students, teachers };

    } catch (error) {
        console.error('[ImportService] Falló la importación:', error);
        throw error;
    }
}
