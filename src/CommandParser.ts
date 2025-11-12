export interface LabelCommand {
  action: 'add' | 'remove';
  target: 'default' | 'post' | 'account';
  labels: string[];
}

export class CommandParser {
  static parse(comment: string): LabelCommand[] {
    const commands: LabelCommand[] = [];
    
    // Parse add commands
    const addParts = comment.split(/\badd\b/i).slice(1).filter(part => part.trim()); // Skip first empty part
    for (const part of addParts) {
      const parsed = this.parseLabelCommand(part, 'add');
      if (parsed) commands.push(parsed);
    }
    
    // Parse remove commands
    const removeParts = comment.split(/\bremove\b/i).slice(1).filter(part => part.trim()); // Skip first empty part
    for (const part of removeParts) {
      const parsed = this.parseLabelCommand(part, 'remove');
      if (parsed) commands.push(parsed);
    }
    
    return commands;
  }
  
  private static parseLabelCommand(part: string, action: 'add' | 'remove'): LabelCommand | null {
    const trimmed = part.trim();
    if (!trimmed) return null;
    
    let target: 'default' | 'post' | 'account' = 'default';
    let labelText = trimmed;
    
    // Check for target specifiers
    if (trimmed.startsWith('-account ') || trimmed.startsWith('-a ')) {
      target = 'account';
      labelText = trimmed.replace(/^-(account|a)\s+/, '');
    } else if (trimmed.startsWith('-post ') || trimmed.startsWith('-p ')) {
      target = 'post';
      labelText = trimmed.replace(/^-(post|p)\s+/, '');
    }
    
    // Parse comma-separated labels
    const labels = labelText
      .split(',')
      .map(label => label.trim())
      .filter(label => label.length > 0);
    
    if (labels.length > 0) {
      return { action, target, labels };
    }
    
    return null;
  }
}