import { User } from '../types';

interface GoogleAuthResponse {
    success: boolean;
    user?: User;
    error?: string;
}

const API_BASE = '/api';

export const verifyGoogleToken = async (token: string): Promise<GoogleAuthResponse> => {
    try {
        const response = await fetch(`${API_BASE}/auth/google-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await response.json();
        return data;
    } catch (error) {
        return { success: false, error: 'Network error' };
    }
}
