import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const PRISMA_BASE_URL = 'https://prisma.bibliohispa.es';
export const API_SECRET = process.env.PRISMA_API_SECRET || 'YOUR_API_SECRET';

async function fetchFromPrisma(endpoint) {
    const url = `${PRISMA_BASE_URL}${endpoint}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'api_secret': API_SECRET,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('403 Forbidden: Invalid API Key');
            }
            if (response.status === 500) {
                throw new Error('500 Internal Server Error: Remote server error');
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

/**
 * Fetches academic data from PrismaEdu and maps it to the local structure.
 * @returns {Promise<{classes: Array, students: Array, teachers: Array}>}
 */
export async function getAcademicData() {
    try {
        console.log('[ImportService] Starting data import...');

        // 1. Fetch all data in parallel
        const [classesRaw, studentsRaw, teachersRaw] = await Promise.all([
            fetchFromPrisma('/api/export/classes'),
            fetchFromPrisma('/api/export/students'),
            fetchFromPrisma('/api/export/users')
        ]);

        // 2. Process Classes
        // Map: id, name, stage, cycle, level
        const classes = classesRaw.map(c => ({
            id: c.id,
            name: c.name,
            stage: c.stage,
            cycle: c.cycle,
            level: c.level
        }));

        // 3. Process Students
        // Map: id, name, email, classId, familyId
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

        // 4. Process Teachers
        // Map: id, name, email, classId, role (always 'TUTOR')
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

        console.log(`[ImportService] Imported: ${classes.length} classes, ${students.length} students, ${teachers.length} teachers.`);

        return {
            classes,
            students,
            teachers
        };

    } catch (error) {
        console.error('[ImportService] Import failed:', error);
        throw error;
    }
}
