import { User } from '../types';

const API_URL = '/api/users';

export const addUser = async (user: User): Promise<void> => {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error('Failed to add user');
};

export const updateUser = async (user: User): Promise<void> => {
    const res = await fetch(`${API_URL}/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error('Failed to update user');
};

export const deleteUser = async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete user');
};

export const importUsers = async (users: User[]): Promise<void> => {
    const res = await fetch(`${API_URL}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(users)
    });
    if (!res.ok) throw new Error('Failed to import users');
};

export const teacherLogin = async (username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    const res = await fetch('/api/auth/teacher-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
        return { success: false, error: data.error || 'Error de autenticación' };
    }
    return { success: true, user: data.user };
};

export const syncStudents = async (): Promise<{ success: boolean; updated?: number; created?: number; error?: string }> => {
    const res = await fetch('/api/sync/students', {
        method: 'POST'
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Error en sincronización');
    }
    return data;
};
