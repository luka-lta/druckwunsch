import { beforeEach, describe, expect, it } from 'vitest';
import { UserRepository } from '../Auth/Repository/UserRepository';
import { parseUserName } from '../Auth/Session';
import { openDatabase } from '../Database';
import { parseMakerWorldLink } from './MakerWorldLink';
import type { ModelPreview, ModelPreviewLoader } from './ModelPreview';
import { refreshMissingPreviews } from './refreshMissingPreviews';
import { PrintRequestRepository, type PrintRequestId } from './Repository/PrintRequestRepository';

const NOW = new Date('2026-10-19T10:00:00Z');
const COVER_URL = 'https://makerworld.bblmw.com/makerworld/model/ABC/design/cover.jpg';

describe('refreshMissingPreviews', () => {
  let printRequests: PrintRequestRepository;
  let createRequest: (preview: ModelPreview) => PrintRequestId;

  beforeEach(() => {
    const database = openDatabase(':memory:');
    printRequests = new PrintRequestRepository(database);
    const userName = parseUserName('Oma');
    const link = parseMakerWorldLink('https://makerworld.com/de/models/701373');
    if (userName === null || link === null) throw new Error('Invalid test fixture');
    const user = new UserRepository(database).loadOrCreateUser(userName, NOW);

    createRequest = (preview) => printRequests.createPrintRequest(
      user.id,
      { link, title: null, color: '', quantity: 1, note: '', isSaved: false },
      preview,
      NOW,
    );
  });

  it('shouldReplaceFallbackTitleAndAddImage', async () => {
    const id = createRequest({ title: 'Modell 701373', imageUrl: null });
    const loader: ModelPreviewLoader = async () => ({ title: 'Gothic Skull Lamp', imageUrl: COVER_URL });

    const count = await refreshMissingPreviews(printRequests, loader);

    expect(count).toBe(1);
    expect(printRequests.loadPrintRequest(id)).toMatchObject({ title: 'Gothic Skull Lamp', imageUrl: COVER_URL });
  });

  it('shouldKeepRequestUnchangedWhenPreviewStillUnavailable', async () => {
    const id = createRequest({ title: 'Modell 701373', imageUrl: null });
    const loader: ModelPreviewLoader = async () => ({ title: 'Modell 701373', imageUrl: null });

    const count = await refreshMissingPreviews(printRequests, loader);

    expect(count).toBe(0);
    expect(printRequests.loadPrintRequest(id)?.title).toBe('Modell 701373');
  });

  it('shouldSkipRequestsThatAlreadyHaveImage', async () => {
    createRequest({ title: 'Vase', imageUrl: COVER_URL });
    let callCount = 0;
    const loader: ModelPreviewLoader = async () => {
      callCount++;
      return { title: 'Anders', imageUrl: COVER_URL };
    };

    await refreshMissingPreviews(printRequests, loader);

    expect(callCount).toBe(0);
  });

  it('shouldKeepTitleEnteredByUser', async () => {
    const id = createRequest({ title: 'Totenkopf-Lampe für Lea', imageUrl: null });
    const loader: ModelPreviewLoader = async () => ({ title: 'Gothic Skull Lamp', imageUrl: COVER_URL });

    await refreshMissingPreviews(printRequests, loader);

    expect(printRequests.loadPrintRequest(id)).toMatchObject({ title: 'Totenkopf-Lampe für Lea', imageUrl: COVER_URL });
  });
});
