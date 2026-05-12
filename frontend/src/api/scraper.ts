import apiClient from './client';

export interface ScraperStatus {
  lastRun: string | null;
  lastResult: string;
  gamesUpdated: number;
  isRunning: boolean;
  lastError: string | null;
}

export interface SimpleScraperStatus {
  lastRun: string | null;
  lastResult: string;
  isRunning: boolean;
  lastError: string | null;
}

export interface BatchYahooBackfillStatus {
  isRunning: boolean;
  total: number;
  done: number;
  failed: number;
  message: string;
}

export interface AllScraperStatus {
  cpbl?: ScraperStatus;
  cpblSchedule?: SimpleScraperStatus;
  cpblFarm?: SimpleScraperStatus;
  cpblRoster?: SimpleScraperStatus;
  npb?: ScraperStatus;
  npbSchedule?: SimpleScraperStatus;
  npbRoster?: SimpleScraperStatus;
  npbFarm?: ScraperStatus;
  npbFarmRoster?: SimpleScraperStatus;
  npbStandings?: SimpleScraperStatus;
  npbBackfill?: SimpleScraperStatus;
  npbPbpBackfill?: SimpleScraperStatus;
  npbFarmPbp?: SimpleScraperStatus;
  yahooFarm?: ScraperStatus;
  yahooFarmSchedule?: SimpleScraperStatus;
  docomoFarm?: SimpleScraperStatus;
  yahooBatchBackfill?: BatchYahooBackfillStatus;
  [key: string]: unknown;
}

export const triggerYahooFarmScraper = async (): Promise<{ updated: number; message: string }> => {
  const res = await apiClient.post('/scraper/trigger-yahoo-farm');
  return res.data;
};

export const triggerYahooFarmScheduleScraper = async (year = 2026, month?: number): Promise<{ message: string }> => {
  const res = await apiClient.post('/scraper/trigger-yahoo-farm-schedule', { year, month: month ?? new Date().getMonth() + 1 });
  return res.data;
};

export const getScraperStatus = async (): Promise<AllScraperStatus> => {
  const res = await apiClient.get('/scraper/status');
  return res.data;
};

export const triggerScraper = async (): Promise<{ updated: number; message: string; status: ScraperStatus }> => {
  const res = await apiClient.post('/scraper/trigger');
  return res.data;
};

export const triggerNpbScraper = async (): Promise<{ updated: number; message: string; status: ScraperStatus }> => {
  const res = await apiClient.post('/scraper/trigger-npb');
  return res.data;
};

export const triggerNpbFarmScraper = async (): Promise<{ added: number; message: string }> => {
  const res = await apiClient.post('/scraper/trigger-npb-farm');
  return res.data;
};

export const cleanupDuplicates = async (): Promise<{ message: string }> => {
  const res = await apiClient.post('/scraper/cleanup-duplicates');
  return res.data;
};

export const triggerNpbScheduleScraper = async (year = 2026): Promise<{ added: number; message: string }> => {
  const res = await apiClient.post('/scraper/trigger-npb-schedule', { year });
  return res.data;
};

export const triggerBackfillNpb = async (): Promise<{ message: string }> => {
  const res = await apiClient.post('/scraper/backfill-npb');
  return res.data;
};

export const triggerPbpBackfill = async (): Promise<{ message: string }> => {
  const res = await apiClient.post('/scraper/backfill-pbp');
  return res.data;
};

export const getPbpBackfillStatus = async (): Promise<{ status: { isRunning: boolean; total: number; done: number; updated: number; skipped: number; message: string } }> => {
  const res = await apiClient.get('/scraper/backfill-pbp');
  return res.data;
};

export interface ImportGameItem {
  date: string;
  time?: string;
  home: string;
  away: string;
  venue?: string;
  league?: string;
  gameNo?: string;
  status?: string;
}

export const importGames = async (games: ImportGameItem[]): Promise<{ message: string; inserted: number; skipped: number; errors: string[] }> => {
  const res = await apiClient.post('/scraper/import-games', { games });
  return res.data;
};

export const backfillDocomoPitch = async (docomoGameId: number, dbGameId: number): Promise<{ success: boolean; message: string; saved: number }> => {
  const res = await apiClient.post('/scraper/backfill-docomo-pitch', { docomoGameId, dbGameId });
  return res.data;
};

export const backfillYahooBatterStats = async (yahooGameId: string, dbGameId: number): Promise<{ success: boolean; message: string; updated: number }> => {
  const res = await apiClient.post('/scraper/backfill-yahoo-batter-stats', { yahooGameId, dbGameId });
  return res.data;
};

export const triggerBatchYahooBackfill = async (): Promise<{ message: string; status: BatchYahooBackfillStatus }> => {
  const res = await apiClient.post('/scraper/batch-backfill-yahoo-batter-stats');
  return res.data;
};

export const getBatchYahooBackfillStatus = async (): Promise<{ status: BatchYahooBackfillStatus }> => {
  const res = await apiClient.get('/scraper/batch-backfill-yahoo-batter-stats');
  return res.data;
};
