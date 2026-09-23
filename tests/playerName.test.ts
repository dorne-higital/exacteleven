import { describe, expect, it } from 'vitest';
import { shortenPlayerName } from '../app/utils/playerName';

describe('shortenPlayerName', () => {
    it('shortens a simple two-word name to first initial + surname', () => {
        expect(shortenPlayerName('Erling Haaland')).toBe('E. Haaland');
    });

    it('takes the initial from a hyphenated first name', () => {
        expect(shortenPlayerName('Heung-Min Son')).toBe('H. Son');
    });

    it('keeps a single lowercase connector attached to the surname', () => {
        expect(shortenPlayerName('Kevin De Bruyne')).toBe('K. De Bruyne');
    });

    it('keeps "van" attached rather than dropping it', () => {
        expect(shortenPlayerName('Robin van Persie')).toBe('R. van Persie');
    });

    it('chains multiple connectors together with the final surname word', () => {
        expect(shortenPlayerName('John van der Berg')).toBe('J. van der Berg');
    });

    it('matches connectors case-insensitively', () => {
        expect(shortenPlayerName('Danny Dos Santos')).toBe('D. Dos Santos');
    });

    it('returns a single-word (mononym) name unchanged', () => {
        expect(shortenPlayerName('Fernandinho')).toBe('Fernandinho');
    });

    it('does not absorb the first name even if it matches a connector word', () => {
        expect(shortenPlayerName('Al Pacino')).toBe('A. Pacino');
    });

    it('collapses down to only the first initial and final surname for a middle name that is not a connector', () => {
        expect(shortenPlayerName('John Michael Smith')).toBe('J. Smith');
    });

    it('keeps a trailing Portuguese/Brazilian generational suffix attached to the real surname', () => {
        expect(shortenPlayerName('Norberto Murara Neto')).toBe('N. Murara Neto');
    });

    it('keeps a trailing suffix attached even when a connector also precedes the surname', () => {
        expect(shortenPlayerName('Emerson Aparecido Leite de Souza Junior')).toBe('E. de Souza Junior');
    });

    it('keeps an English Jr suffix attached to the surname', () => {
        expect(shortenPlayerName('John Smith Jr')).toBe('J. Smith Jr');
    });
});
