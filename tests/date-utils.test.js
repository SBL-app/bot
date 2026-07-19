import { describe, it, expect } from 'vitest';
import { DAYS_INDEX, getNextDayOfWeek } from '../lib/date-utils.js';

describe('DAYS_INDEX', () => {
    it('associe chaque jour à son index JS (0 = dimanche)', () => {
        expect(DAYS_INDEX.sunday).toBe(0);
        expect(DAYS_INDEX.thursday).toBe(4);
        expect(DAYS_INDEX.saturday).toBe(6);
    });
});

describe('getNextDayOfWeek', () => {
    // 2026-01-01 est un jeudi (getDay() === 4).
    const jeudi = new Date(2026, 0, 1, 10, 0, 0);

    it('retourne la prochaine occurrence du jour demandé', () => {
        const next = getNextDayOfWeek('sunday', '21:00', jeudi);
        expect(next).toBeInstanceOf(Date);
        expect(next.getDay()).toBe(0); // dimanche
        expect(next.getDate()).toBe(4); // 2026-01-04
        expect(next.getHours()).toBe(21);
        expect(next.getMinutes()).toBe(0);
    });

    it('renvoie la semaine suivante quand le jour demandé est aujourd\'hui', () => {
        const next = getNextDayOfWeek('thursday', '18:30', jeudi);
        expect(next.getDay()).toBe(4);
        expect(next.getDate()).toBe(8); // +7 jours, jamais le jour même
        expect(next.getHours()).toBe(18);
        expect(next.getMinutes()).toBe(30);
    });

    it('est insensible à la casse du nom de jour', () => {
        const next = getNextDayOfWeek('SuNdAy', '12:00', jeudi);
        expect(next.getDay()).toBe(0);
    });

    it('utilise 21:00 par défaut si l\'heure est invalide', () => {
        const next = getNextDayOfWeek('monday', 'invalide', jeudi);
        expect(next.getHours()).toBe(21);
        expect(next.getMinutes()).toBe(0);
    });

    it('retourne null pour un jour inconnu', () => {
        expect(getNextDayOfWeek('funday', '21:00', jeudi)).toBeNull();
    });

    it('retourne null pour une entrée non-string', () => {
        expect(getNextDayOfWeek(42, '21:00', jeudi)).toBeNull();
        expect(getNextDayOfWeek(null, '21:00', jeudi)).toBeNull();
    });
});
