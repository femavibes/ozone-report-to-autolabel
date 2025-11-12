import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export class ProcessedReportsTracker {
  private processedReports: Set<number> = new Set();
  private filePath: string;

  constructor(filePath: string = '/data/processed_reports.json') {
    this.filePath = filePath;
    this.loadFromFile();
  }

  private loadFromFile(): void {
    if (existsSync(this.filePath)) {
      try {
        const data = JSON.parse(readFileSync(this.filePath, 'utf8'));
        this.processedReports = new Set(data);
      } catch (error) {
        console.log(`Failed to load processed reports tracker: ${error}`);
      }
    }
  }

  private saveToFile(): void {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.filePath, JSON.stringify([...this.processedReports]));
    } catch (error) {
      console.log(`Failed to save processed reports tracker: ${error}`);
    }
  }

  hasBeenProcessed(reportId: number): boolean {
    return this.processedReports.has(reportId);
  }

  markAsProcessed(reportId: number): void {
    this.processedReports.add(reportId);
    this.saveToFile();
  }
}