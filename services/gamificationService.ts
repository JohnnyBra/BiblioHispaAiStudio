
import { Book, User, Transaction, Review } from '../types';

const API_BASE = '/api/actions';

export const checkoutBook = async (userId: string, bookId: string) => {
    const res = await fetch(`${API_BASE}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, bookId })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const returnBook = async (userId: string, bookId: string) => {
    const res = await fetch(`${API_BASE}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, bookId })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const submitReview = async (review: Review) => {
    const res = await fetch(`${API_BASE}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

export const fetchBadges = async () => {
    const res = await fetch('/api/badges');
    if (!res.ok) throw new Error('Failed to fetch badges');
    return res.json();
};
