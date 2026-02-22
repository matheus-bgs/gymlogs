/**
 * Returns the localised display name for an exercise object.
 * Falls back to the English name when no translation is available
 * (e.g. for user-created exercises that have no name_pt set).
 *
 * @param {Object} exercise  - exercise object from the API ({ name, name_pt, ... })
 * @param {string} lang      - current i18n language code, e.g. 'en' or 'pt'
 * @returns {string}
 */
export function exName(exercise, lang) {
    if (!exercise) return '';
    if (lang === 'pt' && exercise.name_pt) return exercise.name_pt;
    return exercise.name;
}
