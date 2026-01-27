import { User } from '../types';

export function compareClassNames(a: string, b: string): number {
    const getWeight = (name: string): number => {
        const n = name.toUpperCase();
        if (n.includes('AÑOS')) return 100;
        if (n.includes('PRIMARIA')) return 200;
        if (n.includes('ESO') || n.includes('SECUNDARIA')) return 300;
        if (n.includes('BACH')) return 400;
        return 500; // Others
    };

    const wa = getWeight(a);
    const wb = getWeight(b);

    if (wa !== wb) return wa - wb;

    // Same stage, check number
    const getNumber = (name: string): number => {
        const match = name.match(/(\d+)/);
        return match ? parseInt(match[0], 10) : 0;
    };

    const na = getNumber(a);
    const nb = getNumber(b);

    if (na !== nb) return na - nb;

    // Same number, check letter
    // We assume the letter is often at the end or after the number
    // Let's just compare the full strings if everything else is equal, or try to find a letter
    // A simple alphabetical comparison of the original string works fine for the letter part
    // if the prefix (3 Años) is identical.
    return a.localeCompare(b);
}

export function compareStudents(a: User, b: User): number {
    // 1. Sort by Class
    const classA = a.className || '';
    const classB = b.className || '';

    const classComparison = compareClassNames(classA, classB);
    if (classComparison !== 0) return classComparison;

    // 2. Sort by Surname
    const surnameA = (a.lastName || '').toLowerCase();
    const surnameB = (b.lastName || '').toLowerCase();

    if (surnameA < surnameB) return -1;
    if (surnameA > surnameB) return 1;

    // 3. Sort by First Name
    const nameA = (a.firstName || '').toLowerCase();
    const nameB = (b.firstName || '').toLowerCase();

    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;

    return 0;
}
