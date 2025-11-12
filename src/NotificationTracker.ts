import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export class NotificationTracker {
  private notifiedReports: Set<string> = new Set();
  private filePath: string;

  constructor(filePath: string = '/data/notified_reports.json') {
    this.filePath = filePath;
    console.log(`NotificationTracker using file: ${this.filePath}`);
    this.loadFromFile();
  }

  private loadFromFile(): void {
    if (existsSync(this.filePath)) {
      try {
        const data = JSON.parse(readFileSync(this.filePath, 'utf8'));
        this.notifiedReports = new Set(data);
      } catch (error) {
        console.log(`Failed to load notification tracker: ${error}`);
      }
    }
  }

  private saveToFile(): void {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.filePath, JSON.stringify([...this.notifiedReports]));
    } catch (error) {
      console.log(`Failed to save notification tracker: ${error}`);
    }
  }

  hasBeenNotified(reportId: string): boolean {
    const result = this.notifiedReports.has(reportId);
    console.log(`Checking if report ${reportId} was notified: ${result}`);
    return result;
  }

  markAsNotified(reportId: string): void {
    console.log(`Marking report ${reportId} as notified`);
    this.notifiedReports.add(reportId);
    this.saveToFile();
  }
}