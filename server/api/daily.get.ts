import { getDailyFormationCode, getDailyObjective, getDailyPrefilledSlotIds } from '#shared/daily';
import { getFormation } from '../../app/utils/formations';
import { assignPrefilledPlayers } from '../utils/assign-prefilled';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default defineEventHandler((event) => {
    const query = getQuery(event);
    const date = String(query.date ?? '');

    if (!DATE_PATTERN.test(date)) {
        throw createError({ statusCode: 400, statusMessage: 'date must be YYYY-MM-DD.' });
    }

    const formationCode = getDailyFormationCode(date);
    const formation = getFormation(formationCode);

    if (!formation) {
        // Unreachable — getDailyFormationCode only ever returns a real
        // FormationCode — but keeps this handler's return type non-optional.
        throw createError({ statusCode: 500, statusMessage: 'Unknown daily formation.' });
    }

    const objective = getDailyObjective(date);
    const prefilledSlotIds = getDailyPrefilledSlotIds(date, formation);
    const prefilled = assignPrefilledPlayers(date, formation, prefilledSlotIds);

    return { date, formationCode, objective, prefilled };
});
