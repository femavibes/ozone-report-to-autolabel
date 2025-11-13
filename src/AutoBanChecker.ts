import { AtpAgent } from "@atproto/api";

interface AutoBanRule {
  label: string;
  threshold: number;
  otherCap: number;
}

export class AutoBanChecker {
  private agent: AtpAgent;
  private labelerDid: string;
  private modLabels: Set<string>;
  private autoBanRules: AutoBanRule[];

  constructor(agent: AtpAgent, labelerDid: string, modLabels: string[], autoBanConfig: string) {
    this.agent = agent;
    this.labelerDid = labelerDid;
    this.modLabels = new Set(modLabels);
    this.autoBanRules = this.parseAutoBanConfig(autoBanConfig);
  }

  private parseAutoBanConfig(config: string): AutoBanRule[] {
    if (!config.trim()) return [];
    
    return config.split(',').map(rule => {
      const parts = rule.trim().split(':');
      if (parts.length !== 3) {
        throw new Error(`Invalid autoban rule format: ${rule}. Expected format: label:threshold:otherCap`);
      }
      
      return {
        label: parts[0].trim(),
        threshold: parseInt(parts[1].trim()),
        otherCap: parseInt(parts[2].trim())
      };
    });
  }

  async checkThresholds(appliedLabel: string, postAuthorDid: string): Promise<void> {
    // Only check if the applied label is a mod label
    if (!this.modLabels.has(appliedLabel)) {
      return;
    }

    console.log(`Checking auto-ban thresholds for user ${postAuthorDid} after applying label: ${appliedLabel}`);

    try {
      // Get moderation history for the account
      const labelCounts = await this.getAccountLabelCounts(postAuthorDid);
      console.log(`Found label counts for ${postAuthorDid}:`, Object.fromEntries(labelCounts));
      
      // Check each auto-ban rule
      for (const rule of this.autoBanRules) {
        if (this.shouldApplyAccountLabel(rule, labelCounts)) {
          await this.applyAccountLabel(postAuthorDid, rule.label);
        }
      }
    } catch (error) {
      console.log(`Error checking auto-ban thresholds: ${error}`);
    }
  }

  private async getAccountLabelCounts(accountDid: string): Promise<Map<string, number>> {
    const labelCounts = new Map<string, number>();
    
    try {
      // Query all events created by our labeler for this account
      const response = await this.agent.tools.ozone.moderation.queryEvents({
        createdBy: this.labelerDid,
        limit: 100 // Should be enough for most cases
      }, {
        headers: {
          "atproto-proxy": `${this.labelerDid}#atproto_labeler`,
        },
      });
      
      console.log(`Found ${response.data.events.length} total events by labeler ${this.labelerDid}`);

      // Process moderation events to count net labels for this account
      let relevantEvents = 0;
      for (const event of response.data.events) {
        // Check if this event is related to the account we're interested in
        const eventAccountDid = this.extractAccountDidFromEvent(event, accountDid);
        if (!eventAccountDid || eventAccountDid !== accountDid) {
          continue;
        }
        relevantEvents++;
        
        if (event.event.$type === "tools.ozone.moderation.defs#modEventLabel") {
          const labelEvent = event.event as any;
          
          // Count added labels (exclude report: prefixed labels)
          if (labelEvent.createLabelVals && Array.isArray(labelEvent.createLabelVals)) {
            for (const label of labelEvent.createLabelVals) {
              if (this.modLabels.has(label) && !label.startsWith('report:')) {
                labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
                console.log(`Counted +1 for label: ${label}`);
              }
            }
          }
          
          // Subtract removed labels (exclude report: prefixed labels)
          if (labelEvent.negateLabelVals && Array.isArray(labelEvent.negateLabelVals)) {
            for (const label of labelEvent.negateLabelVals) {
              if (this.modLabels.has(label) && !label.startsWith('report:')) {
                labelCounts.set(label, Math.max(0, (labelCounts.get(label) || 0) - 1));
                console.log(`Counted -1 for label: ${label}`);
              }
            }
          }
        }
      }
      
      console.log(`Found ${relevantEvents} events relevant to account ${accountDid}`);
    } catch (error) {
      console.log(`Failed to query moderation history for ${accountDid}: ${error}`);
    }

    return labelCounts;
  }

  private shouldApplyAccountLabel(rule: AutoBanRule, labelCounts: Map<string, number>): boolean {
    const primaryCount = labelCounts.get(rule.label) || 0;
    
    // Calculate other mod label count (capped)
    let otherCount = 0;
    for (const [label, count] of labelCounts) {
      if (label !== rule.label && this.modLabels.has(label)) {
        otherCount += count;
      }
    }
    otherCount = Math.min(otherCount, rule.otherCap);
    
    const totalPoints = primaryCount + otherCount;
    
    console.log(`Auto-ban check for ${rule.label}: ${primaryCount} primary + ${otherCount} other (cap: ${rule.otherCap}) = ${totalPoints}/${rule.threshold}`);
    
    return totalPoints >= rule.threshold;
  }

  private async applyAccountLabel(accountDid: string, label: string): Promise<void> {
    try {
      console.log(`Applying auto-ban account label "${label}" to ${accountDid}`);
      
      await this.agent.tools.ozone.moderation.emitEvent({
        event: {
          $type: "tools.ozone.moderation.defs#modEventLabel",
          createLabelVals: [label],
          negateLabelVals: [],
          comment: `Auto-applied due to threshold violation`,
        },
        subject: {
          $type: "com.atproto.admin.defs#repoRef",
          did: accountDid
        },
        createdBy: this.labelerDid,
      }, {
        headers: {
          "atproto-proxy": `${this.labelerDid}#atproto_labeler`,
        },
      });
      
      console.log(`Successfully applied auto-ban label "${label}" to account ${accountDid}`);
    } catch (error) {
      console.log(`Failed to apply auto-ban label "${label}" to ${accountDid}: ${error}`);
    }
  }

  private extractAccountDidFromEvent(event: any, targetAccountDid: string): string | null {
    // For post subjects, extract DID from URI
    if (event.subject && event.subject.$type === "com.atproto.repo.strongRef" && event.subject.uri) {
      const uriParts = event.subject.uri.split('/');
      return uriParts[2] || null; // at://did:plc:xxx/collection/rkey
    }
    
    // For account subjects
    if (event.subject && event.subject.$type === "com.atproto.admin.defs#repoRef" && event.subject.did) {
      return event.subject.did;
    }
    
    return null;
  }
}