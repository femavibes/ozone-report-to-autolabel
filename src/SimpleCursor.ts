import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export class SimpleCursor {
  private cursor: string | undefined;
  private filePath: string;

  constructor(filePath: string = '/data/cursor.txt') {
    this.filePath = filePath;
    this.loadFromFile();
  }

  private loadFromFile(): void {
    if (existsSync(this.filePath)) {
      try {
        this.cursor = readFileSync(this.filePath, 'utf8').trim();
        console.log(`Loaded cursor: ${this.cursor}`);
      } catch (error) {
        console.log(`Failed to load cursor: ${error}`);
      }
    } else {
      console.log('No cursor file found, starting fresh');
    }
  }

  private saveToFile(): void {
    if (!this.cursor) return;
    
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.filePath, this.cursor);
      console.log(`Saved cursor: ${this.cursor}`);
    } catch (error) {
      console.log(`Failed to save cursor: ${error}`);
    }
  }

  get(): string | undefined {
    return this.cursor;
  }

  set(cursor: string): void {
    this.cursor = cursor;
    this.saveToFile();
  }
}