'use strict';

/**
 * Correspondance jour de semaine (français) → index JS (0 = dimanche).
 */
const DAYS_INDEX = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
};

/**
 * Calcule la prochaine occurrence d'un jour de la semaine à une heure donnée.
 *
 * @param {string} dayName - nom du jour en anglais (ex: 'sunday')
 * @param {string} time - heure au format 'HH:MM' (ex: '21:00')
 * @param {Date} [baseDate] - date de référence (par défaut : maintenant)
 * @returns {Date|null} la prochaine occurrence, ou null si le jour est invalide
 */
function getNextDayOfWeek(dayName, time, baseDate = new Date()) {
    if (typeof dayName !== 'string') return null;
    const targetDay = DAYS_INDEX[dayName.toLowerCase()];
    if (targetDay === undefined) return null;

    const result = new Date(baseDate);
    const currentDay = result.getDay();
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
        daysUntilTarget += 7;
    }

    result.setDate(result.getDate() + daysUntilTarget);

    const [hours, minutes] = String(time || '').split(':');
    result.setHours(parseInt(hours, 10) || 21, parseInt(minutes, 10) || 0, 0, 0);

    return result;
}

module.exports = { DAYS_INDEX, getNextDayOfWeek };
